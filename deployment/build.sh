#!/bin/bash
set -euxo pipefail

npm install
systemctl stop discograph-web
npm run build
systemctl start discograph-web
