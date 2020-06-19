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

import { NoopLogger } from '@opentelemetry/core';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { CollectorMetricExporter } from '../../src/platform/browser/index';
import * as collectorTypes from '../../src/types';
import { MetricRecord } from '@opentelemetry/metrics';
import { mockCounter, mockObserver } from '../helper';
const sendBeacon = navigator.sendBeacon;

describe('CollectorMetricExporter - web', () => {
  let collectorExporter: CollectorMetricExporter;
  let spyOpen: any;
  let spySend: any;
  let spyBeacon: any;
  let metrics: MetricRecord[];

  beforeEach(() => {
    spyOpen = sinon.stub(XMLHttpRequest.prototype, 'open');
    spySend = sinon.stub(XMLHttpRequest.prototype, 'send');
    spyBeacon = sinon.stub(navigator, 'sendBeacon');
    collectorExporter = new CollectorMetricExporter({
      logger: new NoopLogger(),
      url: 'http://foo.bar.com',
    });
    metrics.push(mockCounter);
    metrics.push(mockObserver);
  });

  afterEach(() => {
    navigator.sendBeacon = sendBeacon;
    spyOpen.restore();
    spySend.restore();
    spyBeacon.restore();
  });

  describe('export', () => {
    describe('when "sendBeacon" is available', () => {
      it('should successfully send the spans using sendBeacon', done => {
        collectorExporter.export(metrics, () => {});

        setTimeout(() => {
          const args = spyBeacon.args[0];
          const url = args[0];
          const body = args[1];
          const json = JSON.parse(
            body
          ) as collectorTypes.opentelemetryProto.metrics.v1.ExportMetricsServiceRequest;
          const metric1 =
            json.resourceMetrics[0].instrumentationLibraryMetrics[0].metrics[0];
          const metric2 =
            json.resourceMetrics[0].instrumentationLibraryMetrics[0].metrics[0];

          assert.ok(typeof metric1 !== 'undefined', "metric doesn't exist");
          // ensureCounterIsCorrect(metric1);

          assert.ok(
            typeof metric2 !== 'undefined',
            "second metric doesn't exist"
          );
          /*if (metric1) {
            ensureSpanIsCorrect(span1);
          }*/

          const resource = json.resourceMetrics[0].resource;
          assert.ok(typeof resource !== 'undefined', "resource doesn't exist");
          /*if (resource) {
            ensureWebResourceIsCorrect(resource);
          }*/

          assert.strictEqual(url, 'http://foo.bar.com');
          assert.strictEqual(spyBeacon.callCount, 1);

          assert.strictEqual(spyOpen.callCount, 0);

          // ensureExportTraceServiceRequestIsSet(json);

          done();
        });
      });

      it('should log the successful message', done => {
        const spyLoggerDebug = sinon.stub(collectorExporter.logger, 'debug');
        const spyLoggerError = sinon.stub(collectorExporter.logger, 'error');
        spyBeacon.restore();
        spyBeacon = sinon.stub(window.navigator, 'sendBeacon').returns(true);

        collectorExporter.export(metrics, () => {});

        setTimeout(() => {
          const response: any = spyLoggerDebug.args[1][0];
          assert.strictEqual(response, 'sendBeacon - can send');
          assert.strictEqual(spyLoggerError.args.length, 0);

          done();
        });
      });

      it('should log the error message', done => {
        const spyLoggerDebug = sinon.stub(collectorExporter.logger, 'debug');
        const spyLoggerError = sinon.stub(collectorExporter.logger, 'error');
        spyBeacon.restore();
        spyBeacon = sinon.stub(window.navigator, 'sendBeacon').returns(false);

        collectorExporter.export(metrics, () => {});

        setTimeout(() => {
          const response: any = spyLoggerError.args[0][0];
          assert.strictEqual(response, 'sendBeacon - cannot send');
          assert.strictEqual(spyLoggerDebug.args.length, 1);

          done();
        });
      });
    });

    describe('when "sendBeacon" is NOT available', () => {
      let server: any;
      beforeEach(() => {
        (window.navigator as any).sendBeacon = false;
        server = sinon.fakeServer.create();
      });
      afterEach(() => {
        server.restore();
      });

      it('should successfully send the spans using XMLHttpRequest', done => {
        collectorExporter.export(metrics, () => {});

        setTimeout(() => {
          const request = server.requests[0];
          assert.strictEqual(request.method, 'POST');
          assert.strictEqual(request.url, 'http://foo.bar.com');

          const body = request.requestBody;
          const json = JSON.parse(
            body
          ) as collectorTypes.opentelemetryProto.metrics.v1.ExportMetricsServiceRequest;
          const metric1 =
            json.resourceMetrics[0].instrumentationLibraryMetrics[0].metrics[0];

          assert.ok(typeof metric1 !== 'undefined', "span doesn't exist");
          /*if (span1) {
            ensureSpanIsCorrect(span1);
          }*/

          const resource = json.resourceMetrics[0].resource;
          assert.ok(typeof resource !== 'undefined', "resource doesn't exist");
          /*if (resource) {
            ensureWebResourceIsCorrect(resource);
          }*/

          assert.strictEqual(spyBeacon.callCount, 0);

          // ensureExportTraceServiceRequestIsSet(json);

          done();
        });
      });

      it('should log the successful message', done => {
        const spyLoggerDebug = sinon.stub(collectorExporter.logger, 'debug');
        const spyLoggerError = sinon.stub(collectorExporter.logger, 'error');

        collectorExporter.export(metrics, () => {});

        setTimeout(() => {
          const request = server.requests[0];
          request.respond(200);

          const response: any = spyLoggerDebug.args[1][0];
          assert.strictEqual(response, 'xhr success');
          assert.strictEqual(spyLoggerError.args.length, 0);

          assert.strictEqual(spyBeacon.callCount, 0);
          done();
        });
      });

      it('should log the error message', done => {
        const spyLoggerError = sinon.stub(collectorExporter.logger, 'error');

        collectorExporter.export(metrics, () => {});

        setTimeout(() => {
          const request = server.requests[0];
          request.respond(400);

          const response1: any = spyLoggerError.args[0][0];
          const response2: any = spyLoggerError.args[1][0];
          assert.strictEqual(response1, 'body');
          assert.strictEqual(response2, 'xhr error');

          assert.strictEqual(spyBeacon.callCount, 0);
          done();
        });
      });
    });
  });
});