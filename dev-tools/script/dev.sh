#!/bin/bash

docker compose -p blex_dev -f docker-compose.dev.yml up "$@"

docker rmi $(docker images -f "dangling=true" -q)
