# Keyframe Reducer 1.1.1

Add-on gratuit pour Blender 5.2, développé et testé dans Blender **5.2.1 LTS**.
Réduction inspirée du travail avec le Key Reducer de Cinema 4D ; ce n'est pas une
reproduction de son algorithme ni de sa fonction Magnet.

L'interface du plugin est en **anglais** : boutons, options, infobulles et messages.
Ce guide est en français et reprend les libellés anglais exacts.
[English guide](Keyframe_Reducer_Guide_EN.md).

## Installation

1. Télécharger **keyframe_reducer-1.1.1.zip** depuis la [fiche de l’outil](https://killianpichon.art/technical/keyframe-reducer/fr/).
2. Dans Blender : **Edit > Preferences > Add-ons > menu en haut à droite > Install from Disk**.
3. Sélectionner **keyframe_reducer-1.1.1.zip**, sans décompresser ce ZIP.
4. Activer **Keyframe Reducer** si nécessaire.
5. Dans la vue 3D ou le Graph Editor : appuyer sur **N**, puis ouvrir **Key Reducer**.

Blender 5.2.0 minimum. Aucune dépendance, connexion réseau, inscription ou permission spéciale.

Pour mettre à jour la version 1.0.0 ou 1.1.0 : installer le nouveau ZIP au même endroit et
autoriser son remplacement. Enregistrer le projet puis relancer Blender si l'ancienne
interface reste affichée.

## Correctif 1.1.1 : mise à jour sans mélange de versions

La version 1.1.0 pouvait afficher `Settings.__init__() got an unexpected keyword
argument 'key_selection'` après une installation par-dessus la version 1.0.0 dans
la même session Blender. L'interface était nouvelle, mais le moteur Python restait
chargé en version 1.0.0. La version **1.1.1 recharge les composants dans l'ordre**
lors d'une mise à jour. Le titre du panneau affiche maintenant sa version.

Si tu utilises encore la version 1.1.0 : enregistrer la scène puis fermer complètement
et rouvrir Blender permet aussi de vider l'ancienne version du moteur.
Ce problème ne vient pas de la sélection de clés.

## Nouveau : réduire seulement les clés sélectionnées

1. Dans le **Graph Editor**, afficher les canaux à traiter et sélectionner les
   **points des clés** (par exemple avec **B**, sélection rectangulaire).
2. Dans **N > Key Reducer**, choisir **Scope: Selected Keys**.
3. Régler Strength, puis cliquer sur **Reduce on a Copy**.
4. Comparer **Original / Reduced**. **Recalculate from Source** réutilise la
   sélection mémorisée, même si la sélection visuelle a changé entre-temps.
5. Pour traiter un autre passage, afficher **Reduced**, sélectionner ses clés et
   cliquer sur **Reduce New Selection**. Cette étape prend l'Action
   affichée comme nouvelle source et conserve les réductions déjà affichées.
6. Terminer par **Keep Copy for Editing** avant de corriger les clés.

Chaque suite d'au moins **trois clés consécutives sélectionnées** est traitée
séparément. Une clé non sélectionnée coupe la suite : plusieurs plages peuvent
donc être sélectionnées sans réduire le mouvement entre elles. Les première et
dernière clés de chaque plage sont conservées. Les clés isolées ou les sélections
de deux clés restent intactes.

- Les clés non sélectionnées conservent leurs valeurs, poignées, types et sélection.
  Les poignées des bornes sélectionnées peuvent changer côté intérieur ; leur côté
  extérieur est préservé pour garder le mouvement en dehors de la plage.
- Les canaux masqués ou filtrés du Graph Editor et les canaux verrouillés sont exclus
  de la capture. Sélectionner les points, pas seulement leurs poignées.
- Pour position, échelle et Euler, seuls les axes comportant des clés sélectionnées
  participent. Si plusieurs axes participent, leurs plages doivent avoir des clés
  sélectionnées aux mêmes images ; les clés manquantes coupent la plage commune.
- Pour une **rotation quaternion**, sélectionner **W, X, Y et Z ensemble**, aux mêmes
  images. Une sélection partielle est conservée et signalée dans le panneau.
- Une sélection vide affiche une erreur : elle ne déclenche jamais une réduction
  de toute l'Action. Les propriétés personnalisées ne sont toujours pas réduites.
- La capture initiale et une nouvelle sélection se font depuis le Graph Editor
  en mode **F-Curves**. Une sélection mémorisée peut ensuite être recalculée depuis
  la vue 3D. Le Dope Sheet n'est pas utilisé pour capturer la sélection.

La sélection mémorisée et la comparaison sont conservées dans le fichier .blend.
Changer de portée commence une nouvelle comparaison à partir de l'Action affichée.

## Utilisation

1. Sélectionner l'armature et son **Action active**, avec le bon slot.
2. Pour un montage NLA complet, effectuer d'abord **Strip > Bake Action** dans le NLA
   (Visual Keying activé, Pose, pas d'écrasement de l'Action), puis désactiver les pistes
   NLA originales. L'add-on réduit une Action, pas directement la pile NLA.
3. Choisir **Scope: Entire Action**, régler **Strength**, puis cliquer sur **Reduce on a Copy**.
4. Lire l'animation et alterner **Original / Reduced** pour comparer.
5. Ajuster Strength ou les tolérances et cliquer sur **Recalculate from Source**.
   Le calcul repart de l'original, sans accumuler les réductions.
6. Cliquer sur **Keep Copy for Editing**, puis corriger les clés dans le Graph Editor.

Les Actions originales et réduites sont conservées à l'enregistrement du .blend.
La réduction n'écrit aucun fichier à votre place. Enregistrer votre projet normalement.
La comparaison reste disponible après sauvegarde et réouverture si l'add-on est activé.
Les modifications manuelles faites à la copie avant **Keep Copy for Editing** sont remplacées lors
du prochain recalcul ; terminer la comparaison avant de retoucher les clés.

## Réglages

| Option | Effet |
|---|---|
| Strength | Multiplie les tolérances. 0,5 conserve davantage de détails ; 1 est le réglage initial ; 2 autorise deux fois plus d'écart. |
| Smooth Bezier | Reconstruit les poignées Auto Clamped, préserve la vitesse aux extrémités, puis contrôle les courbes réellement évaluées par Blender. |
| Linear | Garde une interpolation linéaire, utile pour les données mocap et parfois plus efficace. |
| Position | Écart vectoriel maximal **en unités locales**, avant l'échelle de l'armature. Dans la scène test, le rig est à 0,01 : 0,1 unité locale correspond à environ 0,001 unité monde pour une translation directe. |
| Rotation | Écart angulaire des quaternions ; pour Euler, écart vectoriel des angles non repliés, pour conserver les rotations complètes. Valeur initiale : 0,5°. |
| Scale | Écart vectoriel des facteurs d'échelle ; initialement 0,001. |
| Selected Bones Only | Ne traite que les os sélectionnés en Pose Mode. Aucun effet sur les autres os ni les transformations de l'objet. |
| Keep Significant Extremes | Protège les changements de direction suffisamment marqués des courbes de position, d'échelle et d'Euler. Les quaternions sont protégés par la tolérance angulaire. |
| Protect Extreme / Breakdown Keys | Conserve les images des clés ayant ces types. Utile pour protéger une pose précise. |
| Validate Every 0.25 Frame | Contrôle plus fin ; le réglage normal vérifie toutes les 0,5 image. Les temps des clés sources sont également vérifiés. |

En portée **Entire Action**, les clés sont alignées **par propriété** : XYZ position, XYZ échelle, XYZ Euler ou
WXYZ quaternion. L'add-on ne force pas tous les os ou toutes les propriétés à avoir
leurs poses aux mêmes images ; il ne déplace pas les clés comme Magnet de C4D.

## Protection et limites

- La source est copiée. Les autres slots de l'Action sont conservés tels quels.
- Les propriétés personnalisées, dont `lockInfluenceWeights` de Mixamo, sont conservées.
- Un canal verrouillé, muet, muni de modificateurs ou contenant une interpolation
  constante/spéciale entraîne la conservation de son groupe de transformation.
- Les quaternions incomplets ou avec inversion de signe sont conservés.
- En portée Entire Action, les groupes dont les canaux n'ont pas les mêmes images
  de début/fin sont conservés. En portée Selected Keys, seules les plages
  communes sélectionnées sont traitées.
- Si la reconstruction ne respecte pas la tolérance, le groupe original est restauré.
- Les bornes de chaque groupe et les clés marquées sont conservées. Les clés de sortie
  utilisent les temps des clés existantes ; aucune clé fractionnaire supplémentaire.
- **La vérification porte sur des échantillons de transformations locales**, pas sur une
  garantie continue entre tous les instants, ni sur la position mondiale des pieds.
  Les petites différences de rotation s'accumulent le long de la chaîne du squelette.
  Une correction IK ou des clés de contact peut donc rester nécessaire.
- La réduction n'efface pas automatiquement les tremblements ou les erreurs de mocap.
- Travail sur l'Action active uniquement ; sortir du Tweak Mode avant utilisation.

## Code et licence

Le ZIP d'installation contient le code Python intégral et le manifeste Blender.
Licence **GPL-3.0-or-later** ; voir LICENSE. Aucun code de Maxon n'est utilisé.
Cette version n'est affiliée ni à Maxon ni à la Blender Foundation.
