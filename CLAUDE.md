# Règles de maintenance du portfolio pour Claude

`AGENTS.md` est la référence de maintenance commune du dépôt et doit être lu avant toute modification. Les règles ci-dessous en reprennent les exigences essentielles pour Claude et s'appliquent à l'ensemble du portfolio.

## Règles impératives

- Préserver le design validé. Ne pas modifier sans demande explicite la direction visuelle, la mise en page, les couleurs, la typographie, les espacements, les animations ou le comportement des composants existants.
- Ne jamais supprimer, renommer, remplacer ou ignorer `CNAME`. Sa valeur et le domaine personnalisé doivent rester intacts.
- Conserver GitHub Pages et le caractère statique du site. Préserver `CNAME`, `.nojekyll`, les chemins sensibles à la casse et la compatibilité avec un hébergement sans serveur applicatif.
- Ne jamais fusionner dans `main`, pousser directement sur `main` ou modifier la configuration de publication sans confirmation explicite du propriétaire.
- Ne modifier que le périmètre demandé et réutiliser les styles, composants et conventions existants.
- Ne supprimer aucun contenu ou média existant sans autorisation explicite.

## Médias et qualité Web

- Optimiser tout nouveau média avant de l'ajouter : compression, dimensions adaptées à l'affichage et format Web approprié.
- Privilégier WebP ou AVIF pour les nouvelles images, avec une solution de repli si nécessaire ; renseigner les dimensions intrinsèques et charger paresseusement les médias hors écran lorsque possible.
- Conserver un HTML accessible : structure sémantique, navigation au clavier, textes alternatifs utiles, libellés explicites et contraste suffisant.

## Validation avant livraison

1. Servir le site localement via HTTP, par exemple avec `python -m http.server 8000`.
2. Tester les liens, ancres et parcours des pages modifiées, y compris les liens externes concernés.
3. Vérifier le chargement des images, vidéos, polices et autres ressources.
4. Contrôler le responsive aux largeurs mobile, tablette et ordinateur, sans débordement horizontal.
5. Inspecter la console du navigateur et l'onglet Réseau ; aucune nouvelle erreur ou ressource manquante ne doit subsister.
6. Confirmer que `CNAME`, `.nojekyll` et la compatibilité GitHub Pages sont préservés.

## Documentation et Git

- Documenter chaque modification dans le compte rendu : objectif, fichiers touchés, justification et validations exécutées.
- Mettre à jour `README.md` ou la documentation appropriée dès qu'une modification affecte l'installation, la structure, les commandes, le contenu durable ou le déploiement.
- Relire le diff, mettre en scène uniquement les fichiers de la tâche et utiliser un message de commit clair et ciblé.
- Indiquer honnêtement toute vérification non effectuée, avec sa raison.
