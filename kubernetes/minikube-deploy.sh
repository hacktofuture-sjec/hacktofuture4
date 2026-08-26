eval $(minikube docker-env)
docker build -t autonomous-recovery .
kubectl apply -f kubernetes/deployment.yaml
kubectl apply -f kubernetes/service.yaml