#!/bin/bash

docker-compose -p blex up -d --build

docker rmi $(docker images -f "dangling=true" -q)
