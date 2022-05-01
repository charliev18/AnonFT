npm run build

docker build --tag python-docker .
docker image prune
docker run -d -p 8080:8080 python-docker

