# Règles de maintenance du portfolio pour Codex

Ce fichier s'applique à l'ensemble du dépôt. Avant toute modification, lire aussi `README.md` et les instructions plus spécifiques éventuellement présentes dans un sous-dossier.

## Principes non négociables

- Préserver le design validé. Ne pas modifier sans demande explicite la direction visuelle, la mise en page, les couleurs, la typographie, les espacements, les animations ou le comportement des composants existants.
- Ne jamais supprimer, renommer, remplacer ou ignorer `CNAME`. Conserver le domaine personnalisé et vérifier que sa valeur reste intacte.
- Maintenir la compatibilité avec GitHub Pages. Préserver notamment `CNAME` et `.nojekyll`, les chemins sensibles à la casse et le fonctionnement du site statique sans serveur applicatif.
- Ne pas fusionner dans `main`, pousser directement sur `main` ou modifier la configuration de publication sans confirmation explicite du propriétaire.
- Limiter chaque intervention au périmètre demandé et ne pas supprimer du contenu ou des médias existants sans autorisation.

## Développement

- Réutiliser les styles, composants et conventions déjà présents avant d'introduire une nouvelle approche.
- Conserver des URLs compatibles avec le chemin de publication GitHub Pages. Éviter les dépendances à des routes serveur, à des secrets ou à un traitement uniquement disponible côté serveur.
- Respecter l'accessibilité de base : HTML sémantique, navigation au clavier, textes alternatifs pertinents, libellés explicites et contraste suffisant.
- Pour tout nouveau média, choisir un format adapté au Web, le compresser, limiter ses dimensions au besoin réel et renseigner ses dimensions intrinsèques lorsque possible. Privilégier WebP ou AVIF pour les images, avec une solution de repli si nécessaire, et le chargement différé pour les médias hors écran.

## Vérifications obligatoires

Avant de considérer une modification terminée :

1. Servir le site localement via HTTP, par exemple avec `python -m http.server 8000`, plutôt que d'ouvrir directement les fichiers avec `file://`.
2. Tester les liens et la navigation des pages modifiées, y compris les ancres, les liens internes, les liens externes concernés et les chemins sensibles à la casse.
3. Vérifier que toutes les images, vidéos, polices et autres ressources concernées se chargent sans erreur.
4. Contrôler le rendu responsive au minimum aux largeurs mobile, tablette et ordinateur, sans débordement horizontal ni contenu inaccessible.
5. Vérifier la console du navigateur et l'onglet Réseau ; ne laisser aucune nouvelle erreur, ressource manquante ou régression évidente.
6. Vérifier que `CNAME`, `.nojekyll` et le mécanisme GitHub Pages sont toujours présents et fonctionnels.

## Documentation et livraison

- Documenter chaque modification dans le compte rendu de la tâche : objectif, fichiers touchés, raison des changements et vérifications effectuées.
- Mettre à jour `README.md` ou la documentation pertinente si une modification change l'installation, la structure, les commandes, le contenu éditorial durable ou le déploiement.
- Utiliser un message de commit clair et ciblé. Avant le commit, relire le diff et ne mettre en scène que les fichiers appartenant à la tâche.
- Signaler explicitement toute vérification non réalisable et la raison, plutôt que de la présenter comme réussie.

## Direction éditoriale

- Ne jamais présenter un logiciel, un moteur ou une technique comme l'accomplissement. Les outils servent uniquement à situer le contexte de production.
- Construire chaque récit autour du problème à résoudre, des décisions prises, des compromis rencontrés et de leur impact sur la production.
- Expliquer pourquoi le travail comptait, pas seulement ce qui a été fabriqué.
- Décrire uniquement les responsabilités réellement exercées. Ne jamais inventer de détail de production, de métrique, de résultat ou de niveau de responsabilité.
- Structurer les projets autour d'une introduction concise, du contexte, de la contribution réelle, du défi, de la réponse de production et du résultat factuel.
- Employer une voix active, précise, humble et naturelle. Éviter le langage marketing, les superlatifs, les buzzwords et les formulations génériques associées aux textes générés.
