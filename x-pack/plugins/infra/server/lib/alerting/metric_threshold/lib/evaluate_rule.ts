/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ElasticsearchClient } from '@kbn/core/server';
import moment from 'moment';
import { MetricExpressionParams } from '../../../../../common/alerting/metrics';
import { InfraSource } from '../../../../../common/source_configuration/source_configuration';
import { getIntervalInSeconds } from '../../../../utils/get_interval_in_seconds';
import { DOCUMENT_COUNT_I18N } from '../../common/messages';
import { createTimerange } from './create_timerange';
import { getData } from './get_data';

export interface EvaluatedRuleParams {
  criteria: MetricExpressionParams[];
  groupBy: string | undefined | string[];
  filterQuery?: string;
  filterQueryText?: string;
}

export type Evaluation = Omit<MetricExpressionParams, 'metric'> & {
  metric: string;
  currentValue: number | null;
  timestamp: string;
  shouldFire: boolean;
  shouldWarn: boolean;
  isNoData: boolean;
};

export const evaluateRule = async <Params extends EvaluatedRuleParams = EvaluatedRuleParams>(
  esClient: ElasticsearchClient,
  params: Params,
  config: InfraSource['configuration'],
  compositeSize: number,
  alertOnGroupDisappear: boolean,
  lastPeriodEnd?: number,
  timeframe?: { start?: number; end: number },
  missingGroups: string[] = []
): Promise<Array<Record<string, Evaluation>>> => {
  const { criteria, groupBy, filterQuery } = params;

  return Promise.all(
    criteria.map(async (criterion) => {
      const interval = `${criterion.timeSize}${criterion.timeUnit}`;
      const intervalAsSeconds = getIntervalInSeconds(interval);
      const intervalAsMS = intervalAsSeconds * 1000;
      const calculatedTimerange = createTimerange(
        intervalAsMS,
        criterion.aggType,
        timeframe,
        lastPeriodEnd
      );

      const currentValues = await getData(
        esClient,
        criterion,
        config.metricAlias,
        groupBy,
        filterQuery,
        compositeSize,
        alertOnGroupDisappear,
        calculatedTimerange,
        lastPeriodEnd
      );

      for (const missingGroup of missingGroups) {
        if (currentValues[missingGroup] == null) {
          currentValues[missingGroup] = {
            value: null,
            trigger: false,
            warn: false,
          };
        }
      }

      const evaluations: Record<string, Evaluation> = {};
      for (const key of Object.keys(currentValues)) {
        const result = currentValues[key];
        if (result.trigger || result.warn || result.value === null) {
          evaluations[key] = {
            ...criterion,
            metric: criterion.metric ?? DOCUMENT_COUNT_I18N,
            currentValue: result.value,
            timestamp: moment(calculatedTimerange.end).toISOString(),
            shouldFire: result.trigger,
            shouldWarn: result.warn,
            isNoData: result.value === null,
          };
        }
      }
      return evaluations;
    })
  );
};
