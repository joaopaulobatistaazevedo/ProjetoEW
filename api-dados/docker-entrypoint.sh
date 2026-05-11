#!/bin/sh
set -e

copiar_recurso_seed() {
    origem="$1"
    destino="$2"

    if [ -d "$origem" ]; then
        mkdir -p "$destino"
        cp -R "$origem"/. "$destino"/
    fi
}

copiar_recurso_seed "/app/docs/recursos/slides-SSI" "/app/uploads/recursos/100000000000000000000001/data"
copiar_recurso_seed "/app/docs/recursos/datasets-ADI" "/app/uploads/recursos/100000000000000000000002/data"
copiar_recurso_seed "/app/docs/recursos/sprites-LI1" "/app/uploads/recursos/100000000000000000000003/data"
copiar_recurso_seed "/app/docs/recursos/exemplos-PL" "/app/uploads/recursos/100000000000000000000004/data"

exec "$@"
