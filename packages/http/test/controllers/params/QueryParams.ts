import { DateTime } from 'luxon';
import { ParameterType } from '../../../src/interfaces.js';
import { BasePath, BaseController, Get, Query, Ok, Uuid, PKey } from '../../../src/index.js';
import { SampleObject, SampleModel, SampleModelWithSchema } from '../../dto/index.js';
import "@spinajs/di";

@BasePath('params/query')
export class QueryParams extends BaseController {
  @Get()
  public simple(@Query() a: string, @Query() b: boolean, @Query() c: number) {
    return new Ok({ a, b, c });
  }

  @Get()
  public queryObject(@Query() a: SampleObject) {
    return new Ok({ a });
  }

  @Get()
  public queryModel(@Query() a: SampleModel) {
    return new Ok({ a });
  }

  @Get()
  public queryMixedData(@Query() a: SampleModel, @Query() b: SampleObject, @Query() c: string) {
    return new Ok({ a, b, c });
  }

  @Get()
  public queryModelWithSchema(@Query() a: SampleModelWithSchema) {
    return new Ok({ a });
  }

  @Get()
  public queryDate(@Query() a: DateTime) {
    return new Ok({ a });
  }

  @Get()
  public queryDateFromUnixtime(@Query() a: DateTime) {
    return new Ok({ a });
  }

  @Get()
  public queryUuid(@Uuid(ParameterType.FromQuery) a: string) {
    return new Ok({ a });
  }

  @Get()
  public pkey(@PKey(ParameterType.FromQuery) id: number) {
    return new Ok({ id });
  }

  @Get()
  public array(@Query() a: string[]) {
    return new Ok({ a });
  }
}
