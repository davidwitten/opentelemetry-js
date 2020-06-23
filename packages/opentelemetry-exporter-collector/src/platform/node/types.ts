/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as grpc from 'grpc';
import { ReadableSpan } from '@opentelemetry/tracing';
import { CollectorExporterError } from '../../types';
import { MetricRecord } from '@opentelemetry/metrics';
/**
 * Queue item to be used to save temporary spans in case the GRPC service
 * hasn't been fully initialised yet
 */
export interface GRPCSpanQueueItem {
  spans: ReadableSpan[];
  onSuccess: () => void;
  onError: (error: CollectorExporterError) => void;
}

/**
 * Queue item to be used to save temporary metrics
 */
export interface GRPCMetricQueueItem {
  metrics: MetricRecord[];
  onSuccess: () => void;
  onError: (error: CollectorExporterError) => void;
}

/**
 * Trace Service Client for sending spans
 */
export interface TraceServiceClient extends grpc.Client {
  export: (
    request: any,
    metadata: grpc.Metadata | undefined,
    callback: Function
  ) => {};
}

/**
 * Metric Service Client for sending metrics
 */
export interface MetricsServiceClient extends grpc.Client {
  export: (
    request: any,
    metadata: grpc.Metadata | undefined,
    callback: Function
  ) => {};
}
