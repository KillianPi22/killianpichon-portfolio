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
5. Verifier le rendu dans l'apercu de droite.
6. Onglet **Modifications** : relire chaque changement en avant/apres, ajuster
   le message propose, puis **Commiter**.
7. Pousser depuis GitHub Desktop quand le resultat convient. C'est ce push,
   et lui seul, qui met a jour killianpichon.art.

### Medias

Tous les chemins d'images passent par `window.__asset('...')`. L'onglet
**Medias** les liste avec une vignette, groupes par bloc de code, et propose
en autocompletion les fichiers reellement presents dans `assets/` et
`projects/`.

Un chemin qui ne correspond a aucun fichier est signale sous le champ. La
verification interroge le serveur local, donc elle reflete ce que le site
servira vraiment.

L'onglet ne remplace pas un fichier : il change la reference. Pour ajouter une
image, la deposer dans `assets/` ou `projects/`, puis la selectionner ici.
Penser a l'optimiser avant (voir la section Medias de `AGENTS.md`).

### Reglages du site

Les metadonnees vivent a **deux endroits** qui doivent rester d'accord :

- les balises statiques de l'en-tete de `index.html` ;
- la table `SCREEN_META`, que le routeur applique a l'execution.

Les robots de Facebook, LinkedIn et Twitter n'executent pas JavaScript : ce
sont les **balises statiques** qui decident de l'apparence des partages, pas
`SCREEN_META`. Un reglage ecrit donc dans toutes ses cibles a la fois — le
titre d'onglet en touche quatre. L'interface indique ce nombre sous chaque
champ.

Si les copies d'un meme reglage ne concordent pas dans le fichier, le champ
le signale et l'enregistrement les realigne. Si une cible est introuvable ou
ambigue, le reglage est marque non modifiable plutot que d'ecrire au hasard.

`twitter:description` est volontairement traitee a part : c'est une version
courte, distincte de la description generale.

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

Trois protections encadrent l'outil local :

- **Routes reservees a la machine hote.** Les routes `/__*` (lecture et ecriture
  des textes) sont refusees a toute requete non locale. En Wi-Fi, un telephone
  peut afficher le site mais jamais atteindre l'editeur.
- **Mot de passe.** `auth.json` contient un sel aleatoire et une empreinte
  PBKDF2-SHA256 (310 000 iterations) : le mot de passe n'y figure pas et ne peut
  pas en etre deduit. Le fichier est ignore par Git et ne quitte pas la machine.
  La session expire au bout de 12 h ou a la fermeture de l'onglet.
- **Ralentissement des essais.** Apres cinq echecs, les tentatives sont bloquees
  temporairement, avec un delai croissant.

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
