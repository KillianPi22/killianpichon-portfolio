# Portfolio de Killian Pichon

Site statique du portfolio de Killian Pichon, pret pour GitHub Pages puis pour un futur domaine personnalise.

## Editeur de contenu local

`tools/` contient un editeur de texte local, destine aux corrections redactionnelles.
Il ne fait partie d'aucun deploiement : GitHub Pages sert uniquement des fichiers
statiques et n'execute jamais ces scripts.

| Fichier | Role |
|---|---|
| `tools/edit-site.cmd` | Double-clic : demarre le serveur et ouvre l'editeur |
| `tools/set-password.cmd` | Definit ou change le mot de passe de l'editeur |
| `tools/serve.ps1` | Serveur local (previsualisation + lecture/ecriture des textes) |
| `tools/editor.html` | Interface : liste des textes a gauche, apercu du site a droite |
| `tools/setup-wifi.cmd` | A lancer une seule fois pour autoriser l'acces iPhone en Wi-Fi |

### Premier lancement

Lancer `tools/set-password.cmd` pour definir le mot de passe. A refaire sur
chaque machine ou l'outil est utilise : l'empreinte est locale et n'est pas
versionnee.

### Utilisation

1. Double-cliquer sur `tools/edit-site.cmd`. L'editeur s'ouvre sur
   `http://localhost:8000/__editor` et demande le mot de passe.
2. Onglet **Textes** : rechercher un texte, le corriger, cliquer sur
   **Enregistrer**. L'ecriture se fait directement dans `index.html`.
3. Onglet **Medias** : remplacer un chemin d'image, avec vignette et
   autocompletion sur les fichiers presents dans `assets/` et `projects/`.
4. Onglet **Reglages** : titre d'onglet, description, favicon, image de
   partage, langue, titres des pages secondaires.
5. Verifier le rendu dans l'apercu de droite. Le bouton **Pointer** de la barre
   d'apercu permet de cliquer un texte ou une image sur la page pour l'ouvrir
   directement dans le panneau de gauche.
6. Onglet **Modifications** : relire chaque changement en avant/apres, ajuster
   le message propose, puis **Commiter**.
7. Pousser depuis GitHub Desktop quand le resultat convient. C'est ce push,
   et lui seul, qui met a jour killianpichon.art.

### Medias

L'onglet **Medias** liste tous les chemins d'images du site avec une vignette,
groupes par bloc de code. Le bouton **Parcourir** ouvre une planche-contact des
fichiers presents dans `assets/` et `projects/`, avec filtre par nom.

Le scan s'ancre sur l'extension du fichier, pas sur `window.__asset(...)` :
certaines images s'ecrivent `__asset(LOGO_BASE + 'sat.png')` et une autre est
posee en `src: "..."` sans `__asset`. Quand un prefixe est concatene, le champ
ne montre que la partie editable et le prefixe est rappele a cote.

Un chemin qui ne correspond a aucun fichier est signale sous le champ. La
verification interroge le serveur local, donc elle reflete ce que le site
servira vraiment.

L'onglet ne remplace pas un fichier : il change la reference. Pour ajouter une
image, la deposer dans `assets/` ou `projects/`, puis la selectionner ici.
Penser a l'optimiser avant (voir la section Medias de `AGENTS.md`).

### Reglages du site

Les metadonnees vivent a **trois endroits** qui doivent rester d'accord :

- les balises statiques de l'en-tete de `index.html` ;
- la table `SCREEN_META`, que le routeur applique a l'execution ;
- les donnees structurees JSON-LD lues par les moteurs de recherche.

Les robots de Facebook, LinkedIn et Twitter n'executent pas JavaScript : ce
sont les **balises statiques** qui decident de l'apparence des partages, pas
`SCREEN_META`. Un reglage ecrit donc dans toutes ses cibles a la fois — le
titre d'onglet en touche maintenant cinq. L'interface indique ce nombre sous
chaque champ.

Si les copies d'un meme reglage ne concordent pas dans le fichier, le champ
le signale et l'enregistrement les realigne. Si une cible est introuvable ou
ambigue, le reglage est marque non modifiable plutot que d'ecrire au hasard.

`twitter:description` est volontairement traitee a part : c'est une version
courte, distincte de la description generale.

Le favicon 96x96 reprend le logo des onglets dans un format adapte aux
resultats de recherche Google. Apres une publication, Google doit revisiter la
page avant de pouvoir l'afficher ; le changement peut donc prendre plusieurs
jours ou quelques semaines.

### Referencement naturel

La page principale contient des donnees structurees `WebSite`, `WebPage` et
`Person` qui decrivent le site et son auteur a partir des informations visibles
dans le portfolio. Le fichier `sitemap.xml` reference l'URL canonique ainsi que
les images representatives des projets, qui sont autrement chargees par
JavaScript.

Le site utilise actuellement des routes avec fragment (`#/about`,
`#/project/celestia`, etc.). Ces vues ne sont pas des URLs indexables distinctes
et ne doivent donc pas etre ajoutees au sitemap. Pour indexer chaque projet
separement, il faudra d'abord leur donner de vraies pages et des URLs sans `#`.

La valeur `lastmod` du sitemap doit etre mise a jour uniquement lors d'un
changement significatif du contenu, des liens ou des donnees structurees de la
page principale.

### Mesure d'audience et consentement

Google Analytics 4 utilise l'identifiant `G-P0LGWRTE4C`. Son integration est
geree par `assets/analytics-consent.js` et `assets/analytics-consent.css`.

Le site applique le mode de consentement **basique** : la balise Google n'est
pas telechargee et aucune donnee Analytics n'est envoyee avant un accord
explicite. Le choix est memorise localement sous
`kp_analytics_consent_v1`. Les visiteurs peuvent le modifier depuis le pied de
page ou `privacy.html`; un refus apres activation recharge la page afin de
retirer completement la balise.

Dans GA4, la conservation des donnees d'evenement et des donnees utilisateur
est fixee a deux mois. Le suivi automatique des changements d'historique est
desactive dans le flux Web, car le site envoie lui-meme les vues des routes a
fragment.

Les vues des routes avec fragment (`#/about`, `#/project/...`) sont envoyees
manuellement avec leur URL complete. La vue automatique initiale est desactivee
dans le code pour eviter les doublons. Si l'identifiant de mesure change, mettre
a jour uniquement la constante `MEASUREMENT_ID` dans
`assets/analytics-consent.js`.

### Commit depuis l'editeur

L'onglet **Modifications** compare le fichier de travail au dernier commit et
affiche chaque texte modifie, avec sa section et sa ligne.

- Le commit ne porte que sur `index.html`. Les autres fichiers modifies ne sont
  jamais embarques, quel que soit l'etat de l'index git.
- Le commit se fait sur la **branche courante**, affichee a cote du bouton.
  Elle apparait en orange si ce n'est pas `main`.
- Rien n'est pousse : le site ne bouge qu'au `git push`.
- Si la structure du fichier a change en dehors de l'editeur (nombre de textes
  different), la comparaison est refusee et renvoie vers GitHub Desktop plutot
  que de deviner.

Le serveur s'arrete automatiquement une vingtaine de secondes apres la fermeture
de l'onglet de l'editeur, ou immediatement via le bouton **Quitter**.

### Notes

- Une copie horodatee de `index.html` est creee avant chaque enregistrement dans
  `tools/.backups/` (ignore par Git, 20 copies conservees).
- Si `index.html` est modifie en dehors de l'editeur (edition manuelle, changement
  de branche), l'editeur le detecte et se resynchronise automatiquement.
- Une modification dont le texte source a change entre-temps est refusee et
  signalee, jamais appliquee a l'aveugle.
- L'editeur ne touche qu'au texte editorial : ni mise en page, ni styles, ni images.

### Securite

Le site publie sur GitHub Pages n'est pas modifiable par cet outil : Pages sert
des fichiers statiques et n'execute jamais `serve.ps1`. Les corrections
n'affectent que les fichiers locaux, jusqu'au `git push` qui, lui, met a jour
killianpichon.art.

Quatre protections encadrent l'outil local :

- **Routes reservees a la machine hote.** Les routes `/__*` (lecture et ecriture
  des textes) sont refusees a toute requete non locale. En Wi-Fi, un telephone
  peut afficher le site mais jamais atteindre l'editeur.
- **Mot de passe.** `auth.json` contient un sel aleatoire et une empreinte
  PBKDF2-SHA256 (310 000 iterations) : le mot de passe n'y figure pas et ne peut
  pas en etre deduit. Le fichier est ignore par Git et ne quitte pas la machine.
  La session expire au bout de 12 h ou a la fermeture de l'onglet.
- **Ralentissement des essais.** Apres cinq echecs, les tentatives sont bloquees
  temporairement, avec un delai croissant.
- **Fichiers jamais servis.** `tools/auth.json`, `tools/.backups/`, `.git/` et
  `.claude/` vivent dans le dossier du site mais n'en font pas partie : le
  serveur repond 404, meme a une requete locale. Le filtre porte sur le chemin
  resolu et non sur l'URL, donc aucune variante d'encodage ne le contourne.
  Sans lui, un telephone connecte en Wi-Fi pourrait lire l'empreinte du mot de
  passe et l'attaquer hors ligne.

### Contenus a acces restreint

Le portfolio peut reveler un lien externe apres saisie d'un code d'acces. Le
code et l'URL ne sont pas publies en clair : `assets/protected-content.js`
derive une cle avec PBKDF2-HMAC-SHA256 (600 000 iterations), puis dechiffre une
charge AES-256-GCM. Les essais consecutifs sont ralentis dans l'onglet courant.

Pour preparer une nouvelle ressource, lancer depuis PowerShell 7 :

```powershell
./tools/protect-content.ps1 -ResourceId nom-stable -Target 'https://example.com/contenu'
```

Le script demande le code sans l'afficher et imprime une configuration a copier
dans la donnee de projet ou de section. Chaque ressource recoit un sel et un
nonce aleatoires ; le meme code peut donc etre reutilise sans produire la meme
charge chiffree. Pour des audiences ou des accords differents, preferer un code
distinct par ressource : la fuite d'un code reutilise compromettrait toutes les
ressources qui l'emploient. Ne jamais versionner le code ou l'URL en clair.

Cette protection reste entierement executee dans le navigateur et ne remplace
pas une authentification serveur. Un visiteur peut automatiser des essais hors
de l'interface, et un lien YouTube non repertorie peut etre repartage par toute
personne qui l'a obtenu. Ne pas placer de document NDA dans le depot GitHub
Pages : pour un contenu reellement sensible, utiliser un hebergement prive avec
controle d'identite cote serveur, ou le partage prive de la plateforme video.

Toute la solidite du dispositif tient donc a l'entropie du code. La charge
chiffree etant publique, un attaquant ne passe pas par le formulaire : il la
copie et l'attaque hors ligne, sans subir le ralentissement. Mesure faite sur le
site : 91 ms par essai dans le navigateur, mais de l'ordre de 10 000 essais par
seconde sur une carte graphique dediee. Un mot du dictionnaire, un titre de film
ou une date tombe en quelques secondes. Choisir une phrase de cinq mots
aleatoires, ou seize caracteres aleatoires, et ne jamais deriver le code du nom
du projet, du client ou du festival.

### Acces iPhone (Wi-Fi)

Windows n'autorise pas l'ecoute reseau sans privileges. Lancer **une seule fois**
`tools/setup-wifi.cmd` (il demande l'elevation). Ensuite `edit-site.cmd` affiche
l'adresse a saisir sur le telephone, connecte au meme reseau. Sans cette etape,
l'editeur fonctionne normalement mais reste limite a `localhost`.

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
