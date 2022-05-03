#!/bin/bash

docker-compose up -d --build

docker rmi $(docker images -f "dangling=true" -q)