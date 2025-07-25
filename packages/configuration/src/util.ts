/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigVar } from '@spinajs/configuration-common';
import * as fs from 'fs';
import _ from 'lodash';
import { dirname, join, resolve } from 'path';

/**
 * Hack to inform ts that jasmine var is declared to skip syntax error
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare let jasmine: never;

export function parseArgv(param: string): string {
  const index = process.argv.indexOf(param);

  if (index === -1 || process.argv.length <= index + 1) {
    return undefined;
  }

  return process.argv[index + 1];
}

export function findBasePath(path: string): string {
  if (fs.existsSync(join(path, 'node_modules'))) {
    return path;
  }

  const parentPath = dirname(path);

  // if we reach root eg c:\
  // and nothing is found return null
  if (parentPath === path) {
    return null;
  }

  return findBasePath(resolve(path, '..'));
}

export function merge(to: unknown, from: unknown): unknown {
  _.mergeWith(to, from, (src, dest) => {
    if (_.isArray(src) && _.isArray(dest)) {
      const tmp = src.concat(dest);
      return _.uniqWith(tmp, _.isEqual);
    } else if (!src) {
      return dest;
    }
  });

  return to;
}

export function mergeArrays(target: unknown[], source: unknown[]): unknown {
  if (_.isArray(target)) {
    return target.concat(source);
  }
}

// clean require cache config
// http://stackoverflow.com/questions/9210542/node-js-require-cache-possible-to-invalidate
export function uncache(file: string) {
  delete require.cache[`${file}`];
  return file;
}

export function filterDirs(dir: string) {
  if (fs.existsSync(dir)) {
    return true;
  }
  return false;
}

export function pickString(obj: { [key: string]: any }): [string, string][] {
  return Object.keys(obj)
    .filter((k) => typeof obj[k] === 'string')
    .map((k) => {
      return [k, obj[k]];
    });
}

export function pickObjects(obj: { [key: string]: any }): [string, any][] {
  return Object.keys(obj)
    .filter((k) => (typeof obj[k] === 'object' || Array.isArray(obj[k])) && obj[k] !== null)
    .map((k) => {
      return [k, obj[k]];
    });
}

/**
 * recursively maps object values
 *
 * @param obj
 * @param fn
 * @returns
 */
export function mapObject(obj: any, fn: (obj: any) => any) {
  if(typeof obj !== 'object') return obj;
  return Object.keys(obj).reduce((acc: any, key: string) => {
    const value = obj[key];
    if (Array.isArray(value)) {
      acc[key] = value.map((x) => fn(mapObject(x, fn)));
    } else if (typeof value === 'object' && value !== null && !(value instanceof ConfigVar)) {
      acc[key] = fn(mapObject(value, fn));
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
}
