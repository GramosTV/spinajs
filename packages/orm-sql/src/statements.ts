import { JoinMethod, LazyQueryStatement } from '@spinajs/orm';
/* eslint-disable prettier/prettier */
import { SqlWhereCompiler } from './compilers.js';
import { NewInstance } from '@spinajs/di';
import { ModelBase, SqlOperator, BetweenStatement, JoinStatement, ColumnStatement, ColumnRawStatement, InStatement, IQueryStatementResult, RawQueryStatement, WhereStatement, ExistsQueryStatement, ColumnMethodStatement, WhereQueryStatement, WithRecursiveStatement, GroupByStatement, RawQuery, DateWrapper, DateTimeWrapper, Wrap, WrapStatement, ValueConverter, extractModelDescriptor } from '@spinajs/orm';

function _columnWrap(column: string, tableAlias: string, isAggregate?: boolean): string {
  if (tableAlias && !isAggregate) {
    return `\`${tableAlias}\`.\`${column}\``;
  }

  return `\`${column}\``;
}

@NewInstance()
export class SqlRawStatement extends RawQueryStatement {
  public clone(): SqlRawStatement {
    return new SqlRawStatement(this._query, this._bindings);
  }

  public build(): IQueryStatementResult {
    return {
      Bindings: this._bindings,
      Statements: [`${this._query}`],
    };
  }
}

@NewInstance()
export class SqlLazyQueryStatement extends LazyQueryStatement {

  public clone(): SqlLazyQueryStatement {
    return new SqlLazyQueryStatement(this.callback);
  }

  build(): IQueryStatementResult {
    this.callback?.call();

    return {
      Bindings: [],
      Statements: [],
    }
  }

}

@NewInstance()
export class SqlWithRecursiveStatement extends WithRecursiveStatement {
  public clone(): SqlWithRecursiveStatement {
    return new SqlWithRecursiveStatement(this.container, this._name, this._query, this._rcKeyName, this._pkName);
  }

  public build(): IQueryStatementResult {
    const initialQuery = this._query.clone().clearJoins().toDB();

    const joinStmt = this.container.resolve(JoinStatement, [this._query, this._query.Model, 'recursive_cte', JoinMethod.RECURSIVE, this._pkName, this._rcKeyName, '$recursive$', '$recursive_cte$']);
    this._query.JoinStatements.push(joinStmt);
    const additionalQuery = this._query.clone().clearWhere().setAlias('$recursive$').toDB();
    const cte_columns = this._query
      .getColumns()
      .map((c: ColumnStatement) => c.Column)
      .join(',');

    return {
      Bindings: initialQuery.bindings.concat(additionalQuery.bindings),
      Statements: [cte_columns, initialQuery.expression, additionalQuery.expression],
    };
  }
}

@NewInstance()
export class SqlBetweenStatement extends BetweenStatement {
  public clone(): SqlBetweenStatement {
    return new SqlBetweenStatement(this._column, this._val, this._not, this._tableAlias);
  }

  public build(): IQueryStatementResult {
    const exprr = this._not ? 'NOT BETWEEN' : 'BETWEEN';

    return {
      Bindings: this._val,
      Statements: [`${_columnWrap(this._column, this._tableAlias)} ${exprr} ? AND ?`],
    };
  }
}

@NewInstance()
export class SqlGroupByStatement extends GroupByStatement {
  public clone(): SqlGroupByStatement {
    return new SqlGroupByStatement(this._expr, this.TableAlias);
  }

  build(): IQueryStatementResult {
    if (this._expr instanceof RawQuery) {
      return {
        Bindings: this._expr.Bindings ?? [],
        Statements: [`${this._expr.Query}`],
      };
    } else {
      return {
        Bindings: [],
        Statements: [`\`${this._expr}\``],
      };
    }
  }
}

@NewInstance()
export class SqlWhereStatement extends WhereStatement {

  public clone(): SqlWhereStatement {
    return new SqlWhereStatement(
      this._column,
      this._operator,
      this._value,
      this._tableAlias,
      this._container,
      this._model
    );
  }

  public build(): IQueryStatementResult {
    const isNullableQuery = this._operator === SqlOperator.NOT_NULL || this._operator === SqlOperator.NULL;
    const binding = isNullableQuery ? '' : ' ?';
    let column = this._column;
    let val = this._value;

    if (this._model) {
      const desc = extractModelDescriptor(this._model);
      const rel = desc.Relations.get(column as string);
      if (rel) {
        column = rel.ForeignKey;
      }
    }

    if (column instanceof Wrap) {
      const wrapper = this._container.resolve<WrapStatement>(column.Wrapper, [column.Column, this._tableAlias]);
      column = wrapper.wrap();
    } else {
      column = _columnWrap(column, this._tableAlias, this.IsAggregate);

      if (val instanceof ModelBase) {
        val = val.PrimaryKeyValue;
      } else {
        const dsc = extractModelDescriptor(this._model);
        let converter: ValueConverter = null;
        if (dsc && dsc.Converters.has(this._column as string)) {
          converter = this._container.resolve<ValueConverter>(dsc.Converters.get(this._column as string).Class);
        } else {
          const converters = this._container.get<Map<string, any>>('__orm_db_value_converters__');
          if (converters && this._value && converters.has(this._value.constructor.name)) {
            converter = this._container.resolve<ValueConverter>(converters.get(this._value.constructor.name));
            val = converter.toDB(val, null, null);
          }
        }

        val = converter
          ? converter.toDB(
            this._value,
            null,
            dsc.Columns.find((x) => x.Name === this._column),
          )
          : this._value;
      }
    }

    return {
      Bindings: isNullableQuery ? [] : [val],
      Statements: [`${column} ${this._operator.toUpperCase()}${binding}`],
    };
  }
}

@NewInstance()
export class SqlJoinStatement extends JoinStatement {
  public clone(): SqlJoinStatement {
    return new SqlJoinStatement(
      this._builder,
      this._model,
      this._alias,
      this._method,
      this._foreignKey,
      this._primaryKey,
      this._tableAlias,
      this._database
    );
  }

  public build(): IQueryStatementResult {
    const method = this._method === JoinMethod.RECURSIVE ? JoinMethod.INNER : this._method;

    if (this._query) {
      return {
        Bindings: this._query.Bindings ?? [],
        Statements: [`${method} ${this._query.Query}`],
      };
    }

    let table = `${this._database ? `\`${this._database}\`.` : ''}\`${this._table}\``;
    let primaryKey = this._primaryKey;
    let foreignKey = this._foreignKey;

    if (this._alias) {
      primaryKey = `\`${this._alias}\`.${this._primaryKey}`;
    }

    if (this._tableAlias) {
      table = `${this._database ? `\`${this._database}\`.` : ''}\`${this._table}\` as \`${this._method === JoinMethod.RECURSIVE ? this._alias : this._tableAlias}\``;
      foreignKey = `\`${this._tableAlias}\`.${this._foreignKey}`;
    }

    return {
      Bindings: [],
      Statements: [`${method} ${table} ON ${primaryKey} = ${foreignKey}`],
    };
  }
}

@NewInstance()
export class SqlInStatement extends InStatement {
  public clone(): SqlInStatement {
    return new SqlInStatement(this._column, this._val, this._not, this._tableAlias);
  }

  public build(): IQueryStatementResult {
    const exprr = this._not ? 'NOT IN' : 'IN';
    let column = _columnWrap(this._column, this._tableAlias);

    return {
      Bindings: this._val,
      Statements: [`${column} ${exprr} (${this._val.map(() => '?').join(',')})`],
    };
  }
}

@NewInstance()
export class SqlColumnStatement extends ColumnStatement {
  public clone(): SqlColumnStatement {
    return new SqlColumnStatement(this._column, this._alias, this._tableAlias, this.Descriptor);
  }

  public build(): IQueryStatementResult {
    let exprr = '';

    if (this.IsWildcard) {
      exprr = '*';
    } else {
      exprr = `\`${this._column}\``;

      if (this._alias) {
        exprr += ` as \`${this._alias}\``;
      }
    }

    if (this._tableAlias) {
      exprr = `\`${this._tableAlias}\`.${exprr}`;
    }

    return {
      Bindings: [],
      Statements: [exprr],
    };
  }
}

@NewInstance()
export class SqlColumnMethodStatement extends ColumnMethodStatement {
  public clone(): SqlColumnMethodStatement {
    return new SqlColumnMethodStatement(this._column, this._method, this._alias, this._tableAlias);
  }

  public build(): IQueryStatementResult {
    let _exprr = '';

    if (this.IsWildcard) {
      _exprr = `${this._method}(${this._column})`;
    } else {
      _exprr = `${this._method}(\`${this._column}\`)`;
    }

    if (this._alias) {
      _exprr += ` as \`${this._alias}\``;
    }

    return {
      Bindings: [] as any[],
      Statements: [_exprr],
    };
  }
}

@NewInstance()
export abstract class SqlDateWrapper extends DateWrapper {
  public wrap(): string {
    if (this._tableAlias) {
      return `DATE(\`${this._tableAlias}\`.\`${this._value}\`)`;
    }

    return `DATE(\`${this._value}\`)`;
  }
}

export abstract class SqlDateTimeWrapper extends DateTimeWrapper {
  public wrap(): string {
    if (this._tableAlias) {
      return `DATETIME(\`${this._tableAlias}\`.\`${this._value}\`)`;
    }

    return `DATETIME(\`${this._value}\`)`;
  }
}

@NewInstance()
export class SqlColumnRawStatement extends ColumnRawStatement {
  public clone(): SqlColumnRawStatement {
    return new SqlColumnRawStatement(this.RawQuery);
  }

  public build(): IQueryStatementResult {
    return {
      Bindings: this.RawQuery.Bindings,
      Statements: [this.RawQuery.Query],
    };
  }
}

@NewInstance()
export class SqlWhereQueryStatement extends WhereQueryStatement {
  public clone(): SqlWhereQueryStatement {
    return new SqlWhereQueryStatement(this._builder, this.TableAlias);
  }

  public build() {
    const _compiler = new SqlWhereCompiler();
    const _result = _compiler.where(this._builder);

    return {
      Bindings: _result.bindings,
      Statements: _result.expression && _result.expression !== '' ? [`( ${_result.expression} )`] : [],
    };
  }
}

@NewInstance()
export class SqlExistsQueryStatement extends ExistsQueryStatement {
  public clone(): SqlExistsQueryStatement {
    return new SqlExistsQueryStatement(this._builder, this._not);
  }

  public build(): IQueryStatementResult {
    let exprr = '';
    const compiled = this._builder.toDB();

    if (this._not) {
      exprr += `NOT EXISTS ( ${compiled.expression} )`;
    } else {
      exprr += `EXISTS ( ${compiled.expression} )`;
    }

    return {
      Bindings: compiled.bindings,
      Statements: [exprr],
    };
  }
}
