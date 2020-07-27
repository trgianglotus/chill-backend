#! /bin/bash
dropdb testchill
createdb testchill
# psql testchill < dump.sql