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

import * as protoLoader from '@grpc/proto-loader';
import * as grpc from 'grpc';
import * as path from 'path';
import * as fs from 'fs';

import * as assert from 'assert';
import * as sinon from 'sinon';
import { CollectorMetricExporter } from '../../src/platform/node';
import * as collectorTypes from '../../src/types';
import { MetricRecord } from '@opentelemetry/metrics';
import {
  mockCounter,
  mockObserver,
  ensureExportedCounterIsCorrect,
  ensureExportedObserverIsCorrect,
  ensureMetadataIsCorrect,
  ensureResourceIsCorrect,
} from '../helper';

const metricsServiceProtoPath =
  'opentelemetry/proto/collector/metrics/v1/metrics_service.proto';
const includeDirs = [path.resolve(__dirname, '../../src/platform/node/protos')];

const address = 'localhost:1501';

type TestParams = {
  useTLS?: boolean;
  metadata?: grpc.Metadata;
};

const metadata = new grpc.Metadata();
metadata.set('k', 'v');

const testCollectorMetricExporter = (params: TestParams) =>
  describe(`CollectorMetricExporter - node ${
    params.useTLS ? 'with' : 'without'
  } TLS, ${params.metadata ? 'with' : 'without'} metadata`, () => {
    let collectorExporter: CollectorMetricExporter;
    let server: grpc.Server;
    let exportedData:
      | collectorTypes.opentelemetryProto.metrics.v1.ResourceMetrics
      | undefined;
    let metrics: MetricRecord[];
    let reqMetadata: grpc.Metadata | undefined;

    before(done => {
      server = new grpc.Server();
      protoLoader
        .load(metricsServiceProtoPath, {
          keepCase: false,
          longs: String,
          enums: String,
          defaults: true,
          oneofs: true,
          includeDirs,
        })
        .then((packageDefinition: protoLoader.PackageDefinition) => {
          const packageObject: any = grpc.loadPackageDefinition(
            packageDefinition
          );
          server.addService(
            packageObject.opentelemetry.proto.collector.metrics.v1
              .MetricsService.service,
            {
              Export: (data: {
                request: collectorTypes.opentelemetryProto.collector.metrics.v1.ExportMetricsServiceRequest;
                metadata: grpc.Metadata;
              }) => {
                try {
                  exportedData = data.request.resourceMetrics[0];
                  reqMetadata = data.metadata;
                } catch (e) {
                  exportedData = undefined;
                }
              },
            }
          );
          const credentials = params.useTLS
            ? grpc.ServerCredentials.createSsl(
                fs.readFileSync('./test/certs/ca.crt'),
                [
                  {
                    cert_chain: fs.readFileSync('./test/certs/server.crt'),
                    private_key: fs.readFileSync('./test/certs/server.key'),
                  },
                ]
              )
            : grpc.ServerCredentials.createInsecure();
          server.bind(address, credentials);
          server.start();
          done();
        });
    });

    after(() => {
      server.forceShutdown();
    });

    beforeEach(done => {
      const credentials = params.useTLS
        ? grpc.credentials.createSsl(
            fs.readFileSync('./test/certs/ca.crt'),
            fs.readFileSync('./test/certs/client.key'),
            fs.readFileSync('./test/certs/client.crt')
          )
        : undefined;
      collectorExporter = new CollectorMetricExporter({
        url: address,
        credentials,
        serviceName: 'basic-service',
        metadata: params.metadata,
      });
      // Overwrites the start time to make tests consistent
      Object.defineProperty(collectorExporter, '_startTime', {
        value: 1592602232694000000,
      });
      metrics = [];
      metrics.push(Object.assign({}, mockCounter));
      metrics.push(Object.assign({}, mockObserver));
      done();
    });

    afterEach(() => {
      exportedData = undefined;
      reqMetadata = undefined;
    });

    describe('export', () => {
      it('should export metrics', done => {
        const responseSpy = sinon.spy();
        collectorExporter.export(metrics, responseSpy);
        setTimeout(() => {
          assert.ok(
            typeof exportedData !== 'undefined',
            'resource' + " doesn't exist"
          );
          let resource;
          if (exportedData) {
            const records =
              exportedData.instrumentationLibraryMetrics[0].metrics;
            resource = exportedData.resource;
            ensureExportedCounterIsCorrect(records[0]);
            ensureExportedObserverIsCorrect(records[1]);
            assert.ok(
              typeof resource !== 'undefined',
              "resource doesn't exist"
            );
            if (resource) {
              ensureResourceIsCorrect(resource);
            }
          }
          if (params.metadata && reqMetadata) {
            ensureMetadataIsCorrect(reqMetadata, params.metadata);
          }
          done();
        }, 200);
      });
    });
  });

describe('CollectorMetricExporter - node (getDefaultUrl)', () => {
  it('should default to localhost', done => {
    const collectorExporter = new CollectorMetricExporter({});
    setTimeout(() => {
      assert.strictEqual(collectorExporter['url'], 'localhost:55678');
      done();
    });
  });
  it('should keep the URL if included', done => {
    const url = 'http://foo.bar.com';
    const collectorExporter = new CollectorMetricExporter({ url });
    setTimeout(() => {
      assert.strictEqual(collectorExporter['url'], url);
      done();
    });
  });
});

testCollectorMetricExporter({ useTLS: true });
testCollectorMetricExporter({ useTLS: false });
testCollectorMetricExporter({ metadata });
