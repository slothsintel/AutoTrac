# AutoTrac
## build and deploy frontend
cd frontend
npm run build
cd ..
git add .
git commit -m "Home: refetch data on focus/visibility"
git push

## build and deploy backend
git add backend
git commit -m "Fix backend module path (backend.app.main) and deploy"
git push