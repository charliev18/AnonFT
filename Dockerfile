FROM gcc:latest as build
WORKDIR /fsSrc
COPY ./FiatShamir .
RUN cd src \
    && g++ -o prove prover/proof_actions.cpp prover/setup.cpp prover/prover.cpp utils.cpp \
    && g++ -o verify verifier/proof_actions.cpp verifier/verifier.cpp utils.cpp


FROM ubuntu:latest

RUN apt-get update \
    && apt-get install -y curl python3 python3-pip

# FROM python:3.9-slim-buster as runtime
WORKDIR /app
COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt
COPY app/ .
COPY --from=build /fsSrc/src/prove .
COPY --from=build /fsSrc/src/verify .
CMD [ "python3", "-u", "-m" , "flask", "run", "--host=0.0.0.0", "--port=8080"]
