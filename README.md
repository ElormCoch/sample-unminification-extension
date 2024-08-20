## Sample Unminification Extension

Implements high fidelity unminification using typescript.

### Steps to test

* Clone repo

* Run `npm install` to install node package dependencies

* Run `npm run build` to build and bundle via webpack into `.\build` directory

* Load unpacked extension into a Chrome build with unminification extension API support

NB: Since this is extension implements an experimental API, you may need to use the `--enable-experimental-extension-apis` flag when launching Chrome to laod the extension correctly.



