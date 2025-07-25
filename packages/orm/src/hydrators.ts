/* eslint-disable prettier/prettier */
import { ForwardRefFunction, RelationType } from './interfaces.js';
import { ModelBase } from './model.js';
import { Injectable, isConstructor } from '@spinajs/di';
import { OneToManyRelationList, SingleRelation } from './relation-objects.js';

export abstract class ModelHydrator {
  public abstract hydrate(target: any, values: any): void;
}

@Injectable(ModelHydrator)
export class DbPropertyHydrator extends ModelHydrator {
  public hydrate(target: ModelBase, values: any): void {
    const descriptor = target.ModelDescriptor;
    if (!descriptor) {
      throw new Error(`cannot hydrate model ${target.constructor.name}, no model descriptor found`);
    }

    // filter out model joined properties
    // we handle it in later
    const keys = Object.keys(values).filter((k) => descriptor.Columns?.find((c) => c.Name === k));
    keys.forEach((k) => {
      // skip if column is primary key & is null
      // we dont want to override pkey of target model
      if (k === descriptor.PrimaryKey && !values[k]) {
        return;
      }

      const column = descriptor.Columns?.find((c) => c.Name === k);

      if (values[k] !== undefined) {
        (target as any)[k] = column.Converter ? column.Converter.fromDB(values[k], values, descriptor.Converters.get(column.Name)?.Options) : values[k];
      }
    });
  }
}

@Injectable(ModelHydrator)
export class NonDbPropertyHydrator extends ModelHydrator {
  public hydrate(target: ModelBase, values: any): void {
    const descriptor = target.ModelDescriptor;
    if (!descriptor) {
      throw new Error(`cannot hydrate model ${target.constructor.name}, no model descriptor found`);
    }

    // get only properties that are not in DB
    const keys = Object.keys(values).filter((k) => descriptor.Columns?.find((c) => c.Name === k) === undefined);
    keys.forEach((k) => {
      (target as any)[k] = values[k];
    });
  }
}

@Injectable(ModelHydrator)
export class OneToManyRelationHydrator extends ModelHydrator {
  public hydrate(target: ModelBase, values: any): void {
    const descriptor = target.ModelDescriptor;
    if (!descriptor) {
      throw new Error(`cannot hydrate model ${target.constructor.name}, no model descriptor found`);
    }

    for (const [key, val] of descriptor.Relations) {
      if (val.Type !== RelationType.Many) {
        continue;
      }

      if (values[key] != null) {
        const entity = target as any;

        const mapRel = values[key].map((x: any) => {
          const tEntity = !isConstructor(val.TargetModel) ? new ((val.TargetModel as ForwardRefFunction)())() : new (val.TargetModel as any)();
          (tEntity as any)['__relationKey__'] = key;
          tEntity.hydrate(x);
          return tEntity;
        });

        const rel = new OneToManyRelationList(target, val, mapRel);
        entity[key] = rel;
        delete (target as any)[val.ForeignKey];
      }
    }
  }
}

@Injectable(ModelHydrator)
export class OneToOneRelationHydrator extends ModelHydrator {
  public hydrate(target: ModelBase, values: any): void {
    const descriptor = target.ModelDescriptor;
    if (!descriptor) {
      throw new Error(`cannot hydrate model ${target.constructor.name}, no model descriptor found`);
    }

    for (const [key, val] of descriptor.Relations) {
      if (val.Type !== RelationType.One) {
        continue;
      }

      if (values[key] != null) {
        const entity = target as any;
        let tEntity = undefined;
        if (!Object.values(values[key]).every((x) => x === null)) {
          tEntity = !isConstructor(val.TargetModel) ? new ((val.TargetModel as ForwardRefFunction)())() : new (val.TargetModel as any)();
          tEntity.hydrate(values[key]);
          (tEntity as any)['__relationKey__'] = key;
        }

        const rel = new SingleRelation(target, val.TargetModel, val, tEntity);
        entity[key] = rel;
      }
    }
  }
}

@Injectable(ModelHydrator)
export class JunctionModelPropertyHydrator extends ModelHydrator {
  public hydrate(target: ModelBase, values: any): void {
    const descriptor = target.ModelDescriptor;
    if (!descriptor) {
      throw new Error(`cannot hydrate model ${target.constructor.name}, no model descriptor found`);
    }

    for (const jt of descriptor.JunctionModelProperties) {
      const entity = new jt.Model();
      entity.hydrate(values.JunctionModel);

      (target as any)[jt.Name] = entity;
    }
  }
}
