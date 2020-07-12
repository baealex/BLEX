#/bin/bash

cd ../../../
cd src

python manage.py dumpdata --natural-foreign --natural-primary -e contenttypes --indent=4 > dump.json