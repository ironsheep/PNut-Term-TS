#!/bin/bash

(set -x;docker run -v /var/run/docker.sock:/var/run/docker.sock -d ./Dockerfile)
