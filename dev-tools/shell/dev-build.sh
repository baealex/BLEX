#!/bin/bash

docker-compose -p blex_dev -f docker-compose.dev.build.yml up --build

docker rmi $(docker images -f "dangling=true" -q)
