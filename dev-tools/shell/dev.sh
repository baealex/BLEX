#!/bin/bash

docker-compose -p blex_dev -f docker-compose.dev.yml up --build

docker rmi $(docker images -f "dangling=true" -q)
