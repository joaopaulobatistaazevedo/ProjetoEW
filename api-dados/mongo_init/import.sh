#!/bin/bash

# Importa dados iniciais para a base de dados recursos_educativos
# Exemplo: mongoimport --host localhost --db recursos_educativos --collection utilizadors --file /docker-entrypoint-initdb.d/utilizadores.json --jsonArray

mongoimport --host localhost --db recursos_educativos --collection utilizadors --file /docker-entrypoint-initdb.d/utilizadores.json --jsonArray
mongoimport --host localhost --db recursos_educativos --collection tiporecursos --file /docker-entrypoint-initdb.d/tiposRecursos.json --jsonArray
mongoimport --host localhost --db recursos_educativos --collection recursos --file /docker-entrypoint-initdb.d/recursos.json --jsonArray
mongoimport --host localhost --db recursos_educativos --collection aips --file /docker-entrypoint-initdb.d/aips.json --jsonArray

# Adapte os comandos abaixo conforme os ficheiros de dados que tiver
# mongoimport --host localhost --db recursos_educativos --collection posts --file /docker-entrypoint-initdb.d/posts.json --jsonArray

echo "Importação inicial concluída."
