# Portfolio de Killian Pichon

Site statique du portfolio de Killian Pichon, pret pour GitHub Pages puis pour un futur domaine personnalise.

## Fiches des projets

Les projets vivent dans `data/projects.js`, charge par `index.html` juste avant
l'application. C'est un script classique, pas un `fetch` : rien a attendre au
chargement, rien qui depende d'un serveur applicatif.

Le fichier est un objet indexe par identifiant de projet. Cet identifiant est
aussi l'adresse de la fiche, `#/project/<id>`, et le nom du dossier de medias
`projects/<id>/`.

### Ce qui decide de l'ordre

Un seul champ : `date`, au format `AAAA-MM`. Le site trie **toujours** du plus
recent au plus ancien, et ce meme tri sert a trois endroits a la fois :

- la grille du haut de l'accueil, qui montre les quatre projets les plus recents ;
- la grille dépliée par le bouton, qui montre tous les suivants ;
- la navigation precedent/suivant en bord de fiche projet, qui boucle aux extremites.

Consequence a garder en tete : ajouter un projet plus recent que les quatre
actuels le fait monter en vitrine et en fait redescendre un autre, sans rien
demander.

### Champs particuliers

| Champ | Role |
|---|---|
| `date` | `AAAA-MM`. Seule source de l'ordre. L'annee affichee en est deduite. |
| `thumb` | Vignette de la grille, chemin relatif a la racine du site. |
| `cardCategory` | Intitule court pour la grille, quand la fiche en porte un plus detaille. Absent, la grille reprend `category`. |
| `listing` | Fiche protegee seulement : `nda` (vignette visible + cadenas), `locked` (cadenas seul), `hidden` (absent des grilles, atteignable par son adresse directe). |
| `relatedProjects` | Identifiants des projets lies. Les fiches ecrites avant l'editeur portent des titres ; les deux formes sont acceptees. |
| `protected` | Fiche entiere chiffree. Voir la section Contenus a acces restreint. |
| `protectedMedia` | Lien chiffre dans une fiche publique. Meme section. |
| `externalTile` | Ajoute a la galerie une tuile qui ouvre `externalUrl` dans un nouvel onglet. `true` pour une tuile sobre, ou un chemin d'image pour la poser sur un visuel. Sans `externalUrl`, rien ne s'affiche. |
| `trailerUrl` | Une seule video. C'est le champ que l'editeur ecrit. |
| `videoUrls` | Plusieurs videos, une tuile chacune. Present, il remplace `trailerUrl`. Voir Videos de la galerie. |

### Videos de la galerie

Chaque video ajoute une tuile a la grille de medias. La tuile reste une affiche
avec son triangle de lecture : **l'iframe n'est creee qu'au clic**. Les vignettes
officielles YouTube sont chargees depuis `i.ytimg.com` avant la lecture, a la
demande du proprietaire. Aucun lecteur ni script de suivi n'est ajoute avant
le clic. Les fiches chiffrees ne chargent aucun apercu video avant deverrouillage.

Au clic, le lecteur s'ouvre **au-dessus de la grille**, dans le meme bloc de
medias, et la grille garde exactement sa geometrie. Il a d'abord ete essaye dans
la tuile elle-meme : les rangees de la grille etant egalisees, un lecteur
vertical y faisait passer le bloc de 484 a 2 880 px. Le format suit la source :
16/9 pleine largeur, ou 9/16 large de 320 px et centre pour un Short YouTube ou
un reel Instagram, reconnus a leur adresse.

Un second clic sur la meme tuile arrete la video, comme la touche Echap. Une
seule video joue a la fois.

Les vignettes gardent un format 16:9 avec au plus trois colonnes sur ordinateur,
deux sur mobile. Le contour accentue indique le survol, le focus clavier et la
video selectionnee pendant la lecture, sans ajouter de texte sur l'image.

YouTube utilise la vignette officielle de chaque video. Instagram utilise une
copie locale preparee depuis les metadonnees officielles de la publication.
En cas d'indisponibilite, `videoPosters` (tableau dans l'ordre de `videoUrls`)
permet de fournir une image par video ; `videoPoster` reste l'image de la premiere.
Les videos hebergees sur Drive conservent ces affiches locales. En dernier
recours, la fiche utilise `heroImage`, la premiere image de galerie ou `thumb`.

Pour actualiser les apercus Instagram publics, executer avec Node 20+ et le
module `sharp` disponible : `node tools/update-video-posters.cjs`. Un chemin
vers le module `sharp` peut aussi etre passe en premier argument. Le script
ignore les fiches protegees et masquees, conserve l'apercu precedent si Instagram
bloque l'acces, et compresse les images en WebP (960 px maximum). Il genere
`data/video-posters.js` et `assets/video-posters/`, a inclure dans la livraison.
Il ne demande aucun code d'acces et ne lit aucun contenu chiffre. Pour une video
d'une fiche protegee, choisir son affiche dans la fiche via l'editeur, sans
exporter sa source vers ce registre public.

`trailerEmbedDisabled` retire la tuile et laisse un bouton sortant. A reserver
aux sources qui refusent reellement l'integration : *Hurtubise* l'a porte a tort
jusqu'au 28 aout 2026, et sa bande-annonce se lit tres bien dans la page.

**Piege a connaitre avant de poser ce drapeau.** Ouvrir `youtube.com/embed/<id>`
directement dans la barre d'adresse renvoie souvent l'erreur 153, meme pour une
video parfaitement integrable : YouTube regarde l'origine de la page appelante,
et il n'y en a pas. Le seul test valable est la fiche elle-meme, servie en local,
drapeau retire.

`year`, `prev` et `next` ne se saisissent plus : l'annee vient de la date, et la
navigation entre fiches suit l'ordre chronologique. Ajouter un projet ne demande
donc plus de corriger la chaine de ses deux voisins.

Les chemins de medias s'ecrivent nus, sans `window.__asset(...)` : la resolution
se fait au chargement.

<!-- Retirer les deux inclusions motion-exploration dans index.html suffit
     a retirer les effets sans toucher au contenu. -->

## Mouvement et profondeur

La version equilibree validee est active par defaut sur le site public, sans
parametre d'URL ni panneau de reglage. Elle respecte la reduction des mouvements.
Ajouter `?lang=fr&explore=1` avant le fragment d'une page permet de retrouver
le panneau de comparaison **Actuel**, **Equilibre** et **Expressif** en bas a
gauche. L'iteration a ete validee sur `codex/design-motion-exploration`, puis
integree a `main` pour publication.

Direction choisie : mouvement equilibre, palette et typographie conservees,
recadrage leger autorise dans les vignettes, images entieres dans la visionneuse.
References : [Foundry](https://www.foundryuk.com/) pour les apparitions de texte
et le fond floute ; [Yanne Sidibe](https://www.yannesidibe.com/work) pour la
courbure des visuels pendant le defilement.

`assets/motion-exploration.css` et `assets/motion-exploration.js` ajoutent les
revelations de paragraphes, la profondeur au pointeur, la courbure des images
et une galerie qui remplit la hauteur de la presentation sur ordinateur. Les
rangees suivent l'ordre des medias, avec un visuel principal plus grand quand
leur nombre le permet. Sur tablette le texte precede la galerie ; sur mobile
les medias utilisent deux colonnes avec une premiere image large si necessaire.

Le fond reprend un media deja affiche, reduit a 128 x 80 px, floute a rayon
constant. A la demande du proprietaire, le halo conserve 80 % de la saturation
du media et une opacite de 23 % pour rendre ses couleurs plus presentes,
sans modifier la palette de l'interface. La courbure utilise Canvas 2D (24 bandes sur ordinateur,
12 sur ecran tactile), une resolution plafonnee et un rendu limite aux medias
visibles. Les nouvelles animations s'arretent au repos, dans un onglet masque,
et avec `prefers-reduced-motion`. Le defilement reste natif. Aucune nouvelle
bibliotheque ni source externe n'est ajoutee. Les acces NDA, sources video,
lecteurs integres, textes et fichiers de publication restent inchanges.

Le halo colore est valide. Les visuels utilisent une seule decoupe arrondie,
sans filet interieur, avec un debord ajuste a la perspective. Une tuile devenue
vide ou « Coming Soon » retire son ancien calque, y compris lors d'un passage
direct d'un projet a l'autre ; ces tuiles ne fournissent jamais d'image au halo.

Les cartes des clients et les fenetres (demo, visionneuse, acces protege,
consentement statistiques) suivent legerement la souris : au maximum 2,5 degres
pour un logo et 1,2 degre pour une fenetre. Elles reviennent a plat a la sortie
du pointeur ou au focus ; la saisie reste stable. Cette profondeur est inactive
au tactile et avec la reduction des mouvements. Les commandes, le consentement
et le controle des acces gardent leur fonctionnement existant.

## Version francaise

L'anglais est la source unique. Il reste ecrit en clair dans `index.html` et
`data/projects.js`, et il s'edite comme avant. Le francais est une couche posee
par-dessus, dans `data/fr.js`, charge juste apres les fiches.

Les badges qui contiennent un libelle localise portent les suffixes `-en` et
`-fr`. La liste des prix choisit la variante avec `window.KP_I18N.lang` au
chargement de la page ; les badges sans suffixe restent communs aux deux langues.

Le CV telechargeable suit la meme regle : `CV_PDF_EN` et `CV_PDF_FR` dans
`index.html`, choisis eux aussi par `window.KP_I18N.lang`. Changer de CV demande
donc de remplacer la bonne des deux adresses, pas une seule constante.

La cle du dictionnaire est **la phrase anglaise elle-meme**, pas un identifiant
invente a tenir en parallele. Une entree absente retombe sur l'anglais : le site
ne casse jamais, meme a moitie traduit.

`data/fr.js` contient cinq sections, documentees en tete du fichier : `ui` pour
les textes d'interface, `uiSection` pour les rares phrases qui doivent diverger
selon l'endroit, `projects` pour les surcharges de fiches champ par champ, `head`
pour les titres et descriptions de page, `stale` pour les traductions dont
l'anglais a change depuis.

### Comment la traduction s'applique

Le point d'accroche est unique : `React.createElement` est enveloppe au
demarrage, et les textes enfants d'un element HTML passent par le dictionnaire.
Seules les chaines qui y ont une entree exacte sont remplacees, donc aucun
composant n'a de `t(...)` a porter et rien ne peut etre traduit par accident.
**En anglais l'enveloppe n'est meme pas installee** : le site tourne sur le React
d'origine, sans surcout.

Les phrases construites avec une valeur ne peuvent pas passer par une
correspondance exacte. Elles s'ecrivent avec des reperes :

```js
window.KP_I18N.t.f('Too many attempts. Try again in {n}s.', { n: 15 })
```

Les reperes sont remplaces **apres** traduction, donc le francais peut les
remettre dans un autre ordre que l'anglais. Une quinzaine d'appels de ce type
existent, dans la fenetre de film protege, les libelles de galerie et le
formulaire de contact.

### Choix de la langue

- `?lang=fr` dans l'adresse a la priorite : un lien partage s'ouvre dans la
  langue de celui qui l'a envoye.
- Sinon, le choix deja fait sur l'appareil, retenu dans `localStorage`.
- Sinon, la langue du navigateur.
- Sinon, l'anglais.

En francais, `?lang=fr` est reinscrit dans l'adresse meme quand la langue vient
du navigateur, pour que l'adresse, l'attribut `lang` et l'adresse canonique
disent toujours la meme chose. Un robot d'indexation, qui n'a ni stockage local
ni preference francaise, atterrit en anglais sur la racine.

Changer de langue **recharge la page**. Les listes de projets se construisent a
l'evaluation du script ; les reconstruire a chaud laisserait un arbre a moitie
traduit.

Le selecteur est dans la barre de navigation. Sur ordinateur, la paire `EN / FR`
apparait a droite des liens, separee par un filet. Sur telephone, elle passe a
gauche contre le monogramme, prend la forme d'une pastille bordee et n'affiche
que la langue vers laquelle on bascule : les quatre liens francais et la paire
complete ne tiennent pas ensemble sous 390 px. Deux paliers etroits suivent,
`374px` puis `359px`, decrits en commentaire dans la feuille de style.

**Ces paliers se placent apres le bloc `@media (max-width: 767px)`, jamais a
l'interieur.** Glissee au milieu de ce bloc, une accolade fermante en coupe la
moitie et prive les fiches projet de toute leur mise en page telephone. C'est
arrive une fois ; le controle rapide est de verifier que les accolades du
`<style>` s'equilibrent et qu'aucun selecteur du bloc telephone n'a disparu.

### Portee de la traduction

Traduits : la navigation, l'accueil, le profil et son CV, la page technique, le
formulaire de contact, les intitules et le contenu des 11 fiches projet, les
messages du contenu protege, les libelles pour lecteurs d'ecran, la banniere de
consentement et `privacy.html`.

Volontairement conserves en anglais, parce que ce sont des noms propres : titres
d'oeuvres, noms de studios, de clients, de festivals et de prix, et noms de
logiciels. Les traduire rendrait le portfolio impossible a recouper avec les
credits publies ailleurs.

### Traduire depuis l'editeur local

L'onglet **Textes** affiche l'anglais et sa traduction ensemble. Le panneau fait
440 px par defaut, ou deux colonnes tiendraient dans 167 px chacune : la
traduction se place donc sous l'anglais, et passe **a cote** des que la barre est
elargie par sa poignee, au-dela de 720 px. C'est une requete de conteneur, pas de
fenetre : la disposition suit la largeur du panneau, pas celle de l'ecran.

Trois filtres : tous, sans traduction, a revoir.

L'onglet **Projets** ajoute un champ francais sous chaque champ traduisible, 20
des 33. Ni les medias, ni les dates, ni les listes d'outils, ni les projets lies.
Un champ francais laisse vide retire la surcharge et la fiche retombe sur
l'anglais, ce qui est le comportement voulu.

**L'enregistrement ecrit le francais d'abord, l'anglais ensuite.** L'ordre
compte : les cles du dictionnaire sont les phrases anglaises, donc enregistrer
l'anglais en premier les renommerait, et le francais partirait ensuite avec les
anciennes cles en ecrasant le report que le serveur vient de faire.

### Le report de traduction

Modifier un texte anglais rend sa traduction orpheline, puisque la cle est la
phrase anglaise. Le serveur deplace donc la traduction sur la nouvelle cle et
l'inscrit dans `stale` ; l'editeur la marque **a revoir** en ambre jusqu'a ce
qu'elle soit relue. Une entree signalee dont la cle a disparu est nettoyee toute
seule.

### Ce que l'editeur ne balaie pas

`Test-Editorial`, dans `tools/serve.ps1`, exige un espace dans la chaine : les
libelles d'un seul mot — `Work`, `Role`, `Tools`, `Nom` — n'ont jamais eu de
ligne dans l'onglet Textes. S'y ajoutent les phrases vivant hors des fichiers
balayes, comme celles de la banniere de consentement. Au total **34 des 192 cles**
sont dans ce cas.

L'onglet Textes les regroupe donc sous **Hors balayage**, anglais en lecture
seule et francais editable. Sans ce groupe, 18 % de l'interface serait
intraduisible depuis l'outil.

### Ecriture de data/fr.js

Le fichier est **reecrit en entier** a chaque enregistrement, jamais retouche par
ligne et decalage comme `index.html` : une entree occupe une ou deux lignes selon
sa longueur et porte parfois un paragraphe entier en guise de cle. Les
regroupements en commentaire sont **generes** a partir des noms de section du
scanner, donc l'ordre du fichier suit celui de la liste affichee dans l'editeur.
Un commentaire ajoute a la main dans ce fichier ne survit pas au premier
enregistrement depuis l'outil ; son en-tete le rappelle.

Une sauvegarde datee part dans `tools/.backups/` avant chaque ecriture, comme
pour les autres fichiers.

**Piege a connaitre pour qui touche a ce code :** les cles JavaScript
distinguent la casse, les tables PowerShell non. `[ordered]@{}` fond `Next
Project` et `Next project` en une seule entree et fait disparaitre une traduction
sans rien signaler. Le code utilise `New-OrderedMap`, qui impose un comparateur
ordinal. Meme raison pour le transport en tableaux de paires plutot qu'en objets
JSON : `ConvertFrom-Json` rend des objets dont les noms de propriete ignorent la
casse.

### Tests

`tools/serve.ps1 -NoServe` charge le script en bibliotheque, sans ouvrir de port
ni exiger de mot de passe. C'est ainsi que la mecanique de traduction a ete
eprouvee : lecture, ecriture, aller-retour sans perte sur les 192 entrees et les
11 fiches, report de cle, et refus d'une modification perimee.

### Les deux fichiers hors application

`assets/analytics-consent.js` et `privacy.html` ne passent pas par React.

Le premier appelle `window.KP_I18N.t(...)` avec un repli sur l'anglais : il est
charge en `defer`, donc apres que `index.html` a defini le moteur.

`privacy.html` est une page statique : elle porte ses deux langues cote a cote
dans le document, `[data-en]` et `[data-fr]`, et un attribut sur `<html>` decide
de celle qui s'affiche. Elle definit aussi un `KP_I18N` minimal pour la banniere,
avec **six traductions dupliquees depuis `data/fr.js`** — charger le dictionnaire
entier pour six phrases couterait 53 Ko sur une page ou personne ne s'attarde.
Si l'une de ces six phrases change, la changer aux deux endroits ; un commentaire
le rappelle dans chaque fichier.

### Referencement

`index.html` declare `hreflang` pour `en`, `fr-CA` et `x-default`, et
`sitemap.xml` liste les deux versions. L'attribut `lang`, le titre, la
description, `og:locale`, `og:url` et l'adresse canonique suivent la langue
affichee.

A savoir : une version francaise servie derriere `?lang=fr` est indexee moins
solidement qu'un vrai dossier `/fr/` en HTML statique, parce qu'elle demande au
moteur d'executer le script. Le choix a ete fait pour n'avoir qu'un seul fichier
a tenir a jour. Passer a `/fr/` plus tard reste possible sans toucher au
dictionnaire.

## Editeur de contenu local

`tools/` contient un editeur de texte local, destine aux corrections redactionnelles.
Il ne fait partie d'aucun deploiement : GitHub Pages sert uniquement des fichiers
statiques et n'execute jamais ces scripts.

| Fichier | Role |
|---|---|
| `tools/edit-site.cmd` | Double-clic : demarre le serveur et ouvre l'editeur |
| `tools/set-password.cmd` | Definit ou change le mot de passe de l'editeur |
| `tools/serve.ps1` | Serveur local : previsualisation, lecture/ecriture d'`index.html` et de `data/projects.js`, televersement des medias |
| `tools/editor.html` | Interface : panneau d'edition a gauche, apercu du site a droite |
| `tools/setup-wifi.cmd` | A lancer une seule fois pour autoriser l'acces iPhone en Wi-Fi |

### Premier lancement

Lancer `tools/set-password.cmd` pour definir le mot de passe. A refaire sur
chaque machine ou l'outil est utilise : l'empreinte est locale et n'est pas
versionnee.

### Utilisation

1. Double-cliquer sur `tools/edit-site.cmd`. L'editeur s'ouvre sur
   `http://localhost:8000/__editor` et demande le mot de passe.
2. Onglet **Textes** : rechercher un texte, le corriger, cliquer sur
   **Enregistrer**. L'ecriture se fait dans `index.html` ou dans
   `data/projects.js` selon l'origine du texte ; les textes des fiches sont
   groupes par projet.
3. Onglet **Projets** : creer, modifier, proteger ou retirer une fiche.
   Voir la section suivante.
4. Onglet **Medias** : remplacer un chemin d'image, avec vignette et
   autocompletion sur les fichiers presents dans `assets/` et `projects/`.
5. Onglet **Reglages** : titre d'onglet, description, favicon, image de
   partage, langue, titres des pages secondaires.
6. Verifier le rendu dans l'apercu de droite. Le bouton **Pointer** de la barre
   d'apercu permet de cliquer un texte ou une image sur la page pour l'ouvrir
   directement dans le panneau de gauche.
7. Onglet **Modifications** : relire chaque changement en avant/apres, ajuster
   le message propose, puis **Commiter**.

### Gestion des projets

L'onglet **Projets** liste les fiches dans l'ordre du site, la plus recente en
tete, et marque celles qui occupent la grille du haut.

**Creer.** Le bouton *Nouveau projet* ouvre un formulaire suivant l'ordre de
lecture de la fiche : identite, contexte, recit, medias, liens. L'identifiant
sert a la fois d'adresse (`#/project/<id>`) et de dossier de medias
(`projects/<id>/`) ; il ne se change plus ensuite. Sont obligatoires le titre,
la categorie, la date, la vignette, l'accroche, le contexte, le role, les
outils, la contribution et les etapes : ce sont les sections que la fiche
publique affiche sans condition.

**Televerser.** Chaque champ media accepte un fichier depose depuis le disque.
Le fichier part **tel quel**, sans conversion : son poids et ses dimensions
sont affiches apres l'envoi, et un fichier de plus de 1 Mo est signale. C'est
un rappel, pas un blocage ; l'optimisation reste a faire en amont, comme le
demande la section Medias d'`AGENTS.md`.

**Proteger.** Le bouton *Proteger* ouvre un dialogue qui demande d'abord **ce
qu'on protege** :

- **toute la fiche** — textes et medias chiffres, seuls la date, le mode
  d'affichage et le libelle de la tuile restent en clair ;
- **un lien seulement** — la fiche reste publique, et seule une adresse est
  chiffree derriere un bouton. C'est le mecanisme du film de *Traveler's
  Introspection*.

Le chiffrement se fait **dans le navigateur** : le code d'acces ne passe pas par
le serveur local et n'est ecrit nulle part. C'est le meme code que celui des
autres contenus proteges.

Pour une fiche entiere, trois presentations dans la grille de l'accueil :

| Mode | Dans la grille | Medias |
|---|---|---|
| **Sous NDA** | vignette visible, assombrie, avec un cadenas | tous deplaces sauf la vignette |
| **Verrou seul** | cadenas sans image | tous deplaces |
| **Masque** | absent des grilles et de la navigation | tous deplaces |

En mode NDA, **la vignette reste lisible publiquement** : c'est ce que la tuile
montre, et le dialogue le rappelle. Elle peut venir de n'importe quel dossier de
medias du site.

Les autres medias partent dans un dossier au nom imprevisible, sous des noms
imprevisibles eux aussi. C'est necessaire : GitHub Pages sert des fichiers
statiques, donc un chemin devinable resterait lisible malgre le chiffrement. Un
media range hors de `projects/<id>/` appartient a un autre projet : il n'est pas
deplace, et l'outil previent qu'il restera public.

Une fiche protegee ne peut etre ni modifiee ni retiree tant qu'elle l'est : la
correspondance entre les noms aleatoires et les noms d'origine vit dans le
contenu chiffre, et la detruire laisserait des fichiers illisibles sur le
disque.

Un lien protege se retire par le bouton *Retirer le lien*. L'adresse chiffree
disparait avec lui : il faut la ressaisir pour la remettre.

**Deproteger.** Le bouton *Deproteger* redemande le code, dechiffre la fiche,
la reecrit en clair et ramene les medias dans `projects/<id>/` sous leurs noms
d'origine. La correspondance des noms voyage dans le contenu chiffre : c'est le
seul endroit d'ou elle peut etre relue.

**Retirer.** La fiche disparait du site, **les medias restent sur le disque**.
Rien d'irreversible : le dossier `projects/<id>/` est conserve.

Toute ecriture met a jour `sitemap.xml`. Les projets proteges ou masques en
sont exclus : y publier le chemin d'un media protege annulerait la protection.

### Commit et publication

Le bouton **Commiter** bascule d'abord sur la branche `content`, en la creant
au besoin, puis commite et pousse cette branche. `main` reste la branche de
publication : l'editeur n'y ecrit jamais, et c'est la fusion vers `main`,
decidee a la main, qui met a jour killianpichon.art.

Le commit porte sur `index.html`, `data/projects.js`, `projects/` et
`sitemap.xml`. Les medias ajoutes sont indexes explicitement, sinon un projet
partirait sans ses images.

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

- Le commit porte sur `index.html`, `data/projects.js`, `projects/` et
  `sitemap.xml`. Aucun autre fichier modifie n'est embarque, quel que soit
  l'etat de l'index git.
- Le commit se fait toujours sur la branche `content`, jamais sur `main`.
  L'editeur y bascule seul, puis pousse cette branche.
- Les fiches de projet se comparent champ par champ, et non chaine par chaine :
  ajouter ou retirer un projet change le nombre de textes, et c'est l'usage
  normal de l'outil.
- Si la structure d'`index.html` a change en dehors de l'editeur (nombre de
  textes different), la comparaison est refusee et renvoie vers GitHub Desktop
  plutot que de deviner.

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

Ce script exige **PowerShell 7** : Windows PowerShell 5.1 n'expose pas AES-GCM.
C'est aussi pourquoi la protection d'une fiche entiere, dans l'onglet Projets,
chiffre depuis le navigateur plutot que depuis le serveur local — qui, lui,
tourne en 5.1. Les deux chemins produisent la meme forme de ressource et se
relisent avec le meme module.

Une fiche protegee depuis l'editeur suit exactement le meme schema, a une
difference pres : la charge chiffree contient la fiche complete
(`{ project: … }`) au lieu d'une simple adresse (`{ url: … }`).

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
