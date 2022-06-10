FROM ethereum/client-go:v1.9.17

ARG ACCOUNT_PASSWORD

WORKDIR /chain

COPY CustomGenesis.json .

RUN geth init ./CustomGenesis.json \
    && rm -f ~/.ethereum/geth/nodekey \
    && echo ${ACCOUNT_PASSWORD} > /tmp/password \
    && geth account new --password /tmp/password \
    && rm -f /tmp/password

ENTRYPOINT ["geth"]




