#/bin/bash

cd ../../../
cd src

python manage.py migrate
python manage.py migrate --run-syncdb
python manage.py loaddata dump.json