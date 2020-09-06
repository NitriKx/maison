/**
 * Copyright 2019, Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const functions = require('firebase-functions');
const { firestore } = require('../admin');
const { smarthome } = require('actions-on-google');
const { google } = require('googleapis');
const Device = require('./device-model');
const jwt = require('jsonwebtoken');

const fulfillment = smarthome();

/**
 * Return a promise to publish the new device config to Cloud IoT Core
 */
function sendCommand(client, deviceId, command) {
  return new Promise((resolve, reject) => {
    const projectId = process.env.GCLOUD_PROJECT;
    const parentName = `projects/${projectId}/locations/europe-west1`;
    const registryName = `${parentName}/registries/${functions.config().cloudiot.registry}`;

    const request = {
      name: `${registryName}/devices/${deviceId}`,
      binaryData: Buffer.from(JSON.stringify(command)).toString('base64')
    };
    client.projects.locations.registries.devices.sendCommandToDevice(request, (err, resp) => {
      if (err) {
        return reject(err);
      } else {
        resolve(resp.data);
      }
    });
  });
}

/**
 * SYNC Intent Handler
 */
fulfillment.onSync(async (body, headers) => {
  try {
    const userId = validateCredentials(headers);
    // Return all devices registered to the requested user
    const result = await firestore.collection('devices').where('owner', '==', userId).get();
    const deviceList = result.docs.map(doc => {
      const device = Device.createDevice(doc.id, doc.data());
      return device.metadata;
    });

    console.log('SYNC Response', deviceList);
    return {
      requestId: body.requestId,
      payload: {
        agentUserId: userId,
        devices: deviceList
      }
    };
  } catch (error) {
    console.error('Unable to authenticate SYNC request', error);
    return {
      requestId: body.requestId,
      payload: {
        errorCode: 'authFailure',
        debugString: error.toString()
      }
    };
  }
});

/**
 * QUERY Intent Handler
 */
fulfillment.onQuery(async (body, headers) => {
  try {
    console.log("Body is " + JSON.stringify(body))
    validateCredentials(headers);

    const deviceSet = {};
    // Return device state for the requested device ids
    for (const target of body.inputs[0].payload.devices) {
      const doc = await firestore.doc(`devices/${target.id}`).get();
      const device = Device.createDevice(doc.id, doc.data());
      deviceSet[device.id] = device.reportState;
    }

    console.log('QUERY Response', deviceSet);
    return {
      requestId: body.requestId,
      payload: {
        devices: deviceSet
      }
    };
  } catch (error) {
    console.error('Unable to authenticate QUERY request', error);
    return {
      requestId: body.requestId,
      payload: {
        errorCode: 'authFailure',
        debugString: error.toString()
      }
    };
  }
});

/**
 * EXECUTE Intent Handler
 */
fulfillment.onExecute(async (body, headers) => {
  try {
    validateCredentials(headers);
    // Update the device configs for each requested id
    const command = body.inputs[0].payload.commands[0];
    const commandParams = command.execution[0].params;
    console.log('EXECUTE Request', JSON.stringify(body));
    console.log('First command is ', JSON.stringify(command));

    // Create a new Cloud IoT client
    const auth = await google.auth.getClient({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = google.cloudiot({
      version: 'v1',
      auth: auth
    });

    // Send the command to the devices
    command.devices.forEach(device => {
      console.log('Sending command ', commandParams, ' to device ', device.id, '...');
      sendCommand(client, device.id, commandParams);
    });
    
    return {
      requestId: body.requestId,
      payload: {
        commands: [
          {
            ids: command.devices.map(device => device.id),
            status: 'PENDING'
          }
        ]
      }
    };
  } catch (error) {
    console.error('Unable to authenticate EXECUTE request', error);
    return {
      requestId: body.requestId,
      payload: {
        errorCode: 'authFailure',
        debugString: error.toString()
      }
    };
  }
});

/**
 * DISCONNECT Intent Handler
 */
fulfillment.onDisconnect(async (body, headers) => {
  try {
    const userId = validateCredentials(headers);

    // Clear the user's current refresh token
    const userRef = firestore.doc(`users/${userId}`);
    await userRef.delete();
    console.log(`Account unlinked: ${userId}`);
    // Return empty body
    return {};
  } catch (error) {
    console.error('Unable to authenticate DISCONNECT request', error);
    return {
      requestId: body.requestId,
      payload: {
        errorCode: 'authFailure',
        debugString: error.toString()
      }
    };
  }
});

/**
 * Verify the request credentials provided by the caller.
 * If successful, return UID encoded in the token.
 */
function validateCredentials(headers) {
  if (!headers.authorization || !headers.authorization.startsWith('Bearer ')) {
    throw new Error('Request missing valid authorization');
  }

  const jwt_secret = functions.config().smarthome.key;
  const token = headers.authorization.split('Bearer ')[1];
  const decoded = jwt.verify(token, jwt_secret);

  return decoded.sub;
}

/**
 * Cloud Function: Handler for Smart Home intents
 */
module.exports = functions.https.onRequest(fulfillment);
