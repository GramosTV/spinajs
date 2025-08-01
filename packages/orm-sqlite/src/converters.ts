/* eslint-disable security/detect-object-injection */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ModelBase, ModelToSqlConverter, OrmException, RelationType } from '@spinajs/orm';

export class SqliteModelToSqlConverter extends ModelToSqlConverter {
  public toSql(model: ModelBase<unknown>): unknown {
    const obj = {};
    const relArr = [...model.ModelDescriptor.Relations.values()];

    model.ModelDescriptor.Columns?.filter((x) => !x.IsForeignKey).forEach((c) => {
      const val = (model as any)[c.Name];
      if (!c.PrimaryKey && !c.Nullable && (val === null || val === undefined || val === '')) {
        throw new OrmException(`Field ${c.Name} cannot be null`);
      }

      // undefined properties we omit,
      // assume that those values have default value in DB defined,
      // SQLITE does not support DEFAULT keyword in insert statements
      // this way insertquerycompiler will not try to fill DEFAULT in missing data
      if (val === undefined) return;

      (obj as any)[c.Name] = c.Converter ? c.Converter.toDB(val, model, c, model.ModelDescriptor.Converters.get(c.Name)?.Options) : val;
    });

    for (const val of relArr) {
      if (val.Type === RelationType.One) {
        if ((model as any)[val.Name].Value) {
          (obj as any)[val.ForeignKey] = (model as any)[val.Name].Value.PrimaryKeyValue;
        }
      }

      // HACK: This is a hack to fix the issue with the recursive relation
      // recursive relations usually dont ahve set @belongsTo but @HasMany decorator and are not in list  of relaitons
      if (val.Recursive) {
        (obj as any)[val.ForeignKey] = (model as any)[val.ForeignKey];
      }
    }

    return obj;
  }
}
