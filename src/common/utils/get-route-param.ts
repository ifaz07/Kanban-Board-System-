import { BadRequestException } from '@nestjs/common';

// Express 5's types allow a route param to be string[] for repeated path
// segments, even though none of our routes actually use that. This narrows
// it back to the plain string every guard/controller here expects.
export function getRouteParam(value: string | string[] | undefined, paramName: string): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(`Expected a single value for route param "${paramName}"`);
  }
  return value;
}
