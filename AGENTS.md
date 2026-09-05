# Règles de maintenance du portfolio pour Codex

Ce fichier s'applique à l'ensemble du dépôt. Avant toute modification, lire aussi `README.md` et les instructions plus spécifiques éventuellement présentes dans un sous-dossier.

## Principes non négociables

- Préserver le design validé. Ne pas modifier sans demande explicite la direction visuelle, la mise en page, les couleurs, la typographie, les espacements, les animations ou le comportement des composants existants.
- Ne jamais supprimer, renommer, remplacer ou ignorer `CNAME`. Conserver le domaine personnalisé et vérifier que sa valeur reste intacte.
- Maintenir la compatibilité avec GitHub Pages. Préserver notamment `CNAME` et `.nojekyll`, les chemins sensibles à la casse et le fonctionnement du site statique sans serveur applicatif.
- Ne pas fusionner dans `main`, pousser directement sur `main` ou modifier la configuration de publication sans confirmation explicite du propriétaire.
- Limiter chaque intervention au périmètre demandé et ne pas supprimer du contenu ou des médias existants sans autorisation.
- Avant toute intervention, comparer la branche de travail à la version actuelle de `main` pour ne pas réintroduire une ancienne version du site.
- Une modification visuelle des médias ne doit jamais modifier leur accès NDA, leur chiffrement, leurs sources vidéo ou leur mode de lecture intégré. Vérifier ces états avant et après ; ne les changer que sur demande explicite.

## Développement

- Réutiliser les styles, composants et conventions déjà présents avant d'introduire une nouvelle approche.
- Conserver des URLs compatibles avec le chemin de publication GitHub Pages. Éviter les dépendances à des routes serveur, à des secrets ou à un traitement uniquement disponible côté serveur.
- Respecter l'accessibilité de base : HTML sémantique, navigation au clavier, textes alternatifs pertinents, libellés explicites et contraste suffisant.
- Pour tout nouveau média, choisir un format adapté au Web, le compresser, limiter ses dimensions au besoin réel et renseigner ses dimensions intrinsèques lorsque possible. Privilégier WebP ou AVIF pour les images, avec une solution de repli si nécessaire, et le chargement différé pour les médias hors écran.

## Sécurité

Le site publié est statique : aucune de ces protections ne s'exécute sur GitHub Pages. Elles encadrent l'outil local et les contenus chiffrés, et une modification qui les affaiblit doit être signalée explicitement.

### Éditeur local (`tools/serve.ps1`)

- Les routes `/__*` sont refusées à toute requête non locale (403). Ne pas les ouvrir au réseau, même pour un test sur téléphone.
- `tools/auth.json` contient un sel aléatoire et une empreinte PBKDF2-SHA256 (310 000 itérations), jamais le mot de passe. Le fichier est ignoré par Git et ne doit ni être versionné, ni être copié ailleurs.
- La liste `$ForbiddenPaths` (`tools/auth.json`, `tools/.backups/`, `tools/.diagnostic-ping.log`, `.git/`, `.claude/`) est filtrée sur le chemin résolu, pas sur l'URL. Ne pas la réduire ni remplacer ce filtre par une comparaison de chaîne : sans lui, un appareil du réseau local lirait l'empreinte du mot de passe.
- Le blocage progressif après cinq échecs et l'expiration de session à 12 h font partie du dispositif. Ne pas les désactiver pour faciliter un test.
- Le commit depuis l'éditeur vise la branche `content`, jamais `main`. Conserver cette contrainte.

### Contenus à accès restreint

- Le chiffrement repose sur PBKDF2-HMAC-SHA256 (600 000 itérations) et AES-256-GCM, avec un sel et un nonce aléatoires par ressource. Ne pas baisser le nombre d'itérations ni réutiliser un sel.
- `tools/protect-content.ps1` exige PowerShell 7 et refuse une cible externe qui n'est pas en HTTPS. La protection d'une fiche entière chiffre depuis le navigateur, car le serveur local tourne en PowerShell 5.1, qui n'expose pas AES-GCM.
- Ne jamais écrire un code d'accès ou une URL protégée en clair : ni dans le dépôt, ni dans un message de commit, ni dans un compte rendu de tâche, ni dans une capture.
- Cette protection est entièrement exécutée dans le navigateur et ne remplace pas une authentification serveur : la charge chiffrée est publique et peut être attaquée hors ligne. Ne pas placer de document sous NDA dans le dépôt et ne pas présenter ce mécanisme comme une garantie de confidentialité.
- Préférer un code distinct par ressource, d'entropie suffisante (phrase de cinq mots aléatoires ou seize caractères aléatoires), jamais dérivé du nom du projet, du client ou du festival.

### Site public

- La mesure d'audience est en mode de consentement basique : la balise Google n'est ni téléchargée ni exécutée avant un accord explicite. Ne rien charger, ne rien envoyer et ne poser aucun identifiant avant ce consentement.
- Ne pas ajouter de script tiers, de police distante ou d'appel réseau externe sans demande explicite du propriétaire.
- Aucun secret, aucune clé et aucune donnée personnelle ne doit entrer dans le dépôt : il est public.

## Vérifications obligatoires

Avant de considérer une modification terminée :

1. Servir le site localement via HTTP, par exemple avec `python -m http.server 8000`, plutôt que d'ouvrir directement les fichiers avec `file://`.
2. Tester les liens et la navigation des pages modifiées, y compris les ancres, les liens internes, les liens externes concernés et les chemins sensibles à la casse.
3. Vérifier que toutes les images, vidéos, polices et autres ressources concernées se chargent sans erreur.
4. Contrôler le rendu responsive au minimum aux largeurs mobile, tablette et ordinateur, sans débordement horizontal ni contenu inaccessible.
5. Vérifier la console du navigateur et l'onglet Réseau ; ne laisser aucune nouvelle erreur, ressource manquante ou régression évidente.
6. Vérifier que `CNAME`, `.nojekyll` et le mécanisme GitHub Pages sont toujours présents et fonctionnels.
7. Vérifier qu'aucun secret n'entre dans le diff : pas de code d'accès ni d'URL protégée en clair, et `tools/auth.json`, `tools/.backups/`, `.git/` et `.claude/` toujours refusés par le serveur local.

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
