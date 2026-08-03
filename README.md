# Portfolio de Killian Pichon

Site statique du portfolio de Killian Pichon, pret pour GitHub Pages puis pour un futur domaine personnalise.

## Publication GitHub Pages

1. Creer un depot GitHub et pousser la branche `main`.
2. Ouvrir **Settings > Pages** dans le depot.
3. Choisir **Deploy from a branch**, puis `main` et le dossier `/ (root)`.
4. Apres l'achat du domaine, le definir comme domaine personnalise.
5. Activer **Enforce HTTPS** des que GitHub le permet.

## DNS a configurer

Pour le domaine racine `killianpichon.art`, ajouter les quatre enregistrements `A` recommandes par GitHub Pages :

- `185.199.108.153`
- `185.199.109.153`
- `185.199.110.153`
- `185.199.111.153`

Ajouter aussi un `CNAME` pour `www` vers `KillianPi22.github.io` afin que les variantes avec et sans `www` fonctionnent ensemble.

Apres l'achat, ajouter un fichier `CNAME` a la racine du depot contenant uniquement `killianpichon.art` afin de conserver le domaine personnalise lors des publications.
