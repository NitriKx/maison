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

export const environment = {
  production: true,
  // TODO: ADD YOUR FIREBASE APP CONFIG HERE
  // TODO: ADD YOUR SMART HOME CLIENT ID HERE
  firebase: {
    apiKey: "AIzaSyCWZ154_23cPQEcHdKenSmnOJbjNTffJiY",
    authDomain: "home-iot-286610.firebaseapp.com",
    databaseURL: "https://home-iot-286610.firebaseio.com/",
    projectId: "home-iot-286610",
    storageBucket: "home-iot-286610.appspot.com",
    messagingSenderId: "597252924814"
  },
  clientId: "google-client-id"
};
