#!/bin/bash

git pull

docker-compose -p bak -f docker-compose.bak.yml up -d --build

sleep 15

docker logs blex_backend_1 2> "`date +"%Y%m%d_%H%M%S"`.log"

docker-compose up -d --build

sleep 15

docker-compose -p bak -f docker-compose.bak.yml down

docker rmi $(docker images -f "dangling=true" -q)