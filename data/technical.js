/* Public tool catalogue. Keep EN/FR together; rebuild with node tools/build-technical.cjs. */
(function (root) {
  const content = {
    updated: '2026-11-20',
    revision: '20261120-c4d-repository',
    en: {
      title: 'Tools & workflows',
      meta: 'Blender add-ons, Cinema 4D Python scripts, production tools and DJ MIDI mappings by Killian Pichon. Personal tools, professional work and experiments to reuse.',
      intro: 'Tools I develop as needs arise: on professional projects, in my own practice and in my hobbies. They show how I work: identify what is slowing a task down, choose the right approach and refine it through use, with AI when it helps.',
      categories: [
        { id: 'professional', title: 'Professional projects', subtitle: 'Corporate & contract work', text: 'Tools developed within a production belong in their project context: the need, my contribution and what can be shared. Technical details will be added to the relevant project pages when I have permission to disclose them.', empty: 'No standalone tool shared here yet.' },
        { id: 'personal', title: 'Personal tools', subtitle: 'Modelling, animation & everyday production', text: 'Small tools developed in my own time to remove friction from the way I work.' },
        { id: 'just-for-fun', title: 'Just for fun', subtitle: 'Hardware mappings, hobbies & utilities', text: 'Experiments that become useful: adapting hardware, connecting software and making everyday tasks simpler.' }
      ],
      reuseTitle: 'Build once, reuse',
      reuse: 'With or without AI during development, I want these tools to remain useful beyond the first task. Once written, a local script can repeat that task without generating a new answer for every use. Select Similar – Angle runs in Cinema 4D.',
      versioning: 'Version control keeps a history of the code and makes changes easier to review. Branches let us test an idea separately, review it together before integrating it and return to an earlier version if needed. This helps an initially personal tool evolve with more confidence and remain easy to fix, adapt and develop collaboratively.',
      ecology: 'Avoiding repeated generations is a way to limit unnecessary computation. It may reduce electricity use and its associated environmental impact. Development, local execution, hardware and the electricity supply all matter to the comparison.',
      ecologySource: 'Context: IEA, Energy and AI',
      tools: [
        {
          downloadRelease: 'select-similar-angle-v1',
          downloadRepository: 'KillianPi22/c4d-select-similar-angle',
          id: 'select-similar-angle', category: 'personal', title: 'Select Similar – Angle',
          pageTitle: 'Select Similar – Angle for Cinema 4D 2026 — Killian Pichon',
          meta: 'Select similar polygon normals in Cinema 4D 2026. Python script with angle tolerance, reference selection and opposite normals. Copy the code or download it.',
          tags: ['Cinema 4D 2026', 'Python', 'Polygon selection'],
          summary: 'Select faces with a similar orientation, even across disconnected parts of an architectural or geometric mesh.',
          need: 'Selecting faces one by one was slowing down my modelling. I wanted the principle of Blender’s Select Similar → Normal directly in Cinema 4D, without switching applications.',
          response: 'I developed this Python script with AI assistance, specifying the controls I actually needed: a reference selection, an angle tolerance and a way to restore the starting point. The floating window stays open while I work in the viewport.',
          result: 'Tested in Cinema 4D 2026 in my own workflow. It lets me repeat the selection and try different tolerances without returning to Blender.',
          preview: { src: 'assets/tools/select-similar-angle-interface-en.webp', fallback: 'assets/tools/select-similar-angle-interface-en.png', width: 416, height: 272, alt: 'English Select Similar – Angle interface with angle slider, opposite normals option, capture, apply and restore buttons, and the generic object name Object.', caption: 'English interface preview, translated from the original screenshot.' },
          features: ['Angle slider from 0 to 180°.', 'Capture the selection to keep a set of reference faces.', 'Apply different tolerances against those references.', 'Restore the original visible selection.', 'Optionally include opposite normals.'],
          workflow: ['Choose the English or French script below, open it in Cinema 4D’s Script Manager and run it.', 'Choose an editable polygon object, switch to Polygon mode and select reference faces.', 'In the English version, click “Capture reference selection”.', 'Set the angle, optionally include opposite normals, then click “Apply selection”.', 'Adjust and apply again, or use “Restore reference selection” to return to the starting faces.'],
          limits: 'Works on the active polygon object, using geometric normals in object-local space. Hidden faces keep their selection state. Phong normals and deformations are not evaluated; n-gons use Cinema 4D’s internal triangles and quads. After a topology change, capture the references again. Ctrl+Z undoes the selection.',
          compatibility: 'French and English versions tested locally in Cinema 4D 2026. Both versions use the same selection logic.',
          scriptLanguage: 'English',
          file: 'downloads/Select_Similar_Angle_EN.py',
          alternate: { language: 'Français', file: 'downloads/Select_Similar_Angle.py', summary: 'French version — code and download' }
        },
        {
          id: 'keyframe-reducer', category: 'personal', title: 'Keyframe Reducer',
          version: '1.1.1', requirements: 'Blender 5.2 or later',
          pageTitle: 'Keyframe Reducer for Blender — Killian Pichon',
          meta: 'Free Blender add-on to reduce animation keyframes on a copy, across an entire Action or selected keys. Version 1.1.1 with English and French guides.',
          tags: ['Blender 5.2', 'Python', 'Animation · v1.1.1'],
          summary: 'Reduce dense animation curves to make motion capture cleanup and manual corrections easier.',
          need: 'Working with Brekel and Kinect v2 capture and Mixamo animations led me to dense curves that were cumbersome to edit in Blender. I wanted a reduction workflow closer to what I use in Cinema 4D, with control over the sections being simplified.',
          response: 'I developed this add-on with AI assistance around a protected source Action, adjustable tolerances and before/after comparison. The Selected Keys mode grew out of a practical need: simplify one passage while preserving the surrounding animation.',
          result: 'The tool lets me compare a reduced copy, adjust the result from the original and keep it for manual editing. The current version was checked in Blender 5.2.1 LTS, including selected sections of a Mixamo animation and updating an already enabled add-on.',
          download: {
            title: 'Download',
            repository: 'KillianPi22/blender-keyframe-reducer',
            repositoryLabel: 'Source code and development on GitHub',
            release: 'v1.1.1',
            counter: 'keyframe-reducer',
            countLabel: 'add-on downloads via GitHub',
            countNote: 'Installable ZIP downloads across public stable releases. Previous site downloads, backup downloads and source archives are excluded.',
            file: 'downloads/keyframe-reducer/keyframe_reducer-1.1.1.zip',
            label: 'Download add-on · v1.1.1 (.zip)',
            note: 'Free · GPL-3.0-or-later · Python source included. Install this ZIP directly in Blender without extracting it. English interface; English and French guides included in the ZIP.'
          },
          features: ['Reduce an Entire Action or only Selected Keys in the Graph Editor.', 'Adjust Strength and separate position, rotation and scale tolerances.', 'Compare Original / Reduced and recalculate from the protected source.', 'Preserve unselected keys, gaps and selection boundaries.', 'Reduce New Selection to continue on another passage, then Keep Copy for Editing.'],
          workflow: ['Download the ZIP above. In Blender, open Edit → Preferences → Add-ons → Install from Disk and select the ZIP without extracting it.', 'Select the armature and its active Action. For an NLA montage, bake the motion to an Action first.', 'Open the Graph Editor, press N and choose Key Reducer. Select Entire Action, or select key points and choose Scope → Selected Keys.', 'Click Reduce on a Copy, compare Original / Reduced, then adjust Strength and use Recalculate from Source if needed.', 'For quaternion rotation, select W, X, Y and Z at matching times. Each selected run needs at least three consecutive keys.', 'Click Keep Copy for Editing before correcting keys manually. To simplify another passage first, show Reduced and use Reduce New Selection.'],
          limits: 'Processes the active Action, not the NLA stack. Error checks sample local transforms; they do not lock feet in world space or automatically remove capture jitter. Quaternion components must be selected together. Selected Keys excludes hidden curves. Locked curves and unsupported channels are preserved.',
          compatibility: 'Requires Blender 5.2 or later. Checked on Windows in Blender 5.2.1 LTS. English interface; guides in English and French. No external dependencies.'
        },
        {
          id: 'denon-sc2000-traktor', category: 'just-for-fun', title: 'Denon DN-SC2000 · Traktor Pro 4',
          meta: 'Denon DN-SC2000 mapping for Traktor Pro 4: two decks, FX and a documented MIDI setup. Version 5.1.0 tested by Killian Pichon.',
          tags: ['Denon DN-SC2000', 'Traktor Pro 4', 'MIDI · v5.1.0'],
          summary: 'A mapping and setup workflow for my two Denon controllers.',
          need: 'Make my two-controller DJ setup dependable and repeatable.',
          response: 'One TSI combines Deck A/B, FX and LED feedback. Loop length and Beatjump size remain independent.',
          result: 'Version 5.1.0 tested and validated locally with my two Denon DN-SC2000 controllers.',
          workflow: ['Identify each controller and its MIDI channel with Monitor.', 'Assign verified input/output ports; disable duplicate mappings.', 'Keep USB connections consistent and check again after moving them.'],
          compatibility: 'My setup: Windows, Traktor Pro 4 and two Denon DN-SC2000 controllers.',
          credits: 'Based on bascurtiz’s mapping; original InstaPadFX work credited to Stewe.',
          external: 'https://maps.djtechtools.com/mappings/22961',
          externalLabel: 'Mapping & complete guide on DJ TechTools',
          externalNote: 'DJ TechTools sign-in required to download.'
        }
      ],
      labels: { technical: 'Technical', open: 'View tool', back: 'All tools & workflows', need: 'The task', response: 'The approach', result: 'In use', features: 'Controls', workflow: 'Workflow', limits: 'Scope & limitations', compatibility: 'Compatibility', code: 'Python source', copy: 'Copy code', download: 'Download .py', downloadTotal: 'downloads via GitHub (FR + EN)', downloadUnavailable: 'Download count unavailable', downloadFallback: 'Backup download', downloadNote: 'Total for both languages and all releases. Code copies and backup downloads are excluded.', copied: 'Code copied.', fallback: 'Automatic copy unavailable. Code selected: use Ctrl+C or ⌘C.', source: 'Code to paste into the Cinema 4D Script Manager', codeHint: 'The complete script below is identical to the downloadable .py file.', credit: 'Credits', nav: 'Tool categories', notes: 'Production notes', privacy: 'Privacy', privacyChoices: 'Privacy choices', demos: 'Other demos', rights: '© 2026 · All rights reserved', work: 'Work', about: 'About', contact: 'Contact' }
    },
    fr: {
      title: 'Outils & méthodes',
      meta: 'Add-ons Blender, scripts Python pour Cinema 4D, outils de production et mappings MIDI DJ de Killian Pichon. Projets professionnels, outils personnels et expérimentations à réutiliser.',
      intro: 'Des outils que je développe au fil des besoins : en production, dans ma pratique personnelle et dans mes hobbies. Ils montrent ma façon de travailler : repérer ce qui ralentit une tâche, choisir les moyens adaptés et ajuster la solution à l’usage, avec l’IA lorsqu’elle peut aider.',
      categories: [
        { id: 'professional', title: 'Projets professionnels', subtitle: 'Projets corpo & contrats', text: 'Les outils développés en production s’expliquent dans le contexte du projet : le besoin, ma contribution et ce qui peut être partagé. Les volets techniques seront ajoutés aux fiches concernées lorsque j’aurai l’autorisation de les divulguer.', empty: 'Aucun outil autonome partagé ici pour le moment.' },
        { id: 'personal', title: 'Outils personnels', subtitle: 'Modélisation, animation & pratique quotidienne', text: 'De petits outils développés sur mon temps libre pour simplifier les tâches qui ralentissent mon travail.' },
        { id: 'just-for-fun', title: 'Just for fun', subtitle: 'Mapping matériel, hobbies & utilitaires', text: 'Des expérimentations qui deviennent utiles : adapter du matériel, relier des logiciels et simplifier les tâches du quotidien.' }
      ],
      reuseTitle: 'Créer une fois, réutiliser',
      reuse: 'Avec ou sans IA pendant le développement, je cherche à faire durer l’utilité de ces outils. Une fois écrit, un script local peut répéter la tâche sans générer une nouvelle réponse à chaque utilisation. Select Similar – Angle fonctionne dans Cinema 4D.',
      versioning: 'Le versionnement conserve l’historique du code et facilite la relecture des changements. Des branches permettent de tester une idée à part, de la relire à plusieurs avant de l’intégrer et de revenir à une version précédente au besoin. Un outil d’abord personnel peut ainsi évoluer avec plus de sécurité, rester facile à corriger ou à adapter, et se développer de manière collaborative.',
      ecology: 'Éviter les générations répétées est une façon de limiter les calculs inutiles. Cela peut réduire la consommation d’électricité et l’impact environnemental associé. Le développement, l’exécution locale, le matériel et la source d’électricité comptent tous dans la comparaison.',
      ecologySource: 'Pour situer le sujet : AIE, Energy and AI',
      tools: [
        {
          downloadRelease: 'select-similar-angle-v1',
          downloadRepository: 'KillianPi22/c4d-select-similar-angle',
          id: 'select-similar-angle', category: 'personal', title: 'Select Similar – Angle',
          pageTitle: 'Select Similar – Angle pour Cinema 4D 2026 — Killian Pichon',
          meta: 'Sélection de polygones par normales similaires dans Cinema 4D 2026 : script Python avec tolérance d’angle, références et normales opposées. Code à copier ou télécharger.',
          tags: ['Cinema 4D 2026', 'Python', 'Sélection de polygones'],
          summary: 'Sélectionner des faces d’orientation similaire, même séparées, sur un maillage architectural ou géométrique.',
          need: 'Sélectionner les faces une par une ralentissait ma modélisation. Je voulais retrouver le principe de Select Similar → Normal de Blender directement dans Cinema 4D, sans changer de logiciel.',
          response: 'J’ai développé ce script Python avec l’aide de l’IA, en précisant les paramètres dont j’avais besoin : une sélection de référence, une tolérance d’angle et la possibilité de revenir au point de départ. La fenêtre reste ouverte pendant que je travaille dans la vue.',
          result: 'Testé dans Cinema 4D 2026 dans mon propre workflow. Il me permet de répéter la sélection et d’essayer différentes tolérances sans revenir dans Blender.',
          preview: { src: 'assets/tools/select-similar-angle-interface.webp?v=20261022-tools-v4', fallback: 'assets/tools/select-similar-angle-interface.png?v=20261022-tools-v4', width: 416, height: 272, alt: 'Interface française de Select Similar – Angle avec curseur d’angle, option de normales opposées, boutons Mémoriser, Appliquer et Restaurer, et le nom générique Objet.', caption: 'La fenêtre flottante de l’outil dans Cinema 4D, avec un nom d’objet générique.' },
          features: ['Un curseur d’angle de 0 à 180°.', 'Mémoriser la sélection pour fixer les faces de référence.', 'Appliquer différentes tolérances à partir de ces références.', 'Restaurer la sélection visible de départ.', 'Une option pour inclure les normales opposées.'],
          workflow: ['Choisir le script français ou anglais ci-dessous, l’ouvrir dans le Script Manager de Cinema 4D et le lancer.', 'Choisir un objet polygonal éditable, passer en mode Polygones et sélectionner les faces de référence.', 'Dans la version française, cliquer sur « Memoriser la selection de reference ».', 'Régler l’angle, inclure les normales opposées si nécessaire, puis cliquer sur « Appliquer la selection ».', 'Ajuster et appliquer à nouveau, ou utiliser « Restaurer la selection de reference » pour retrouver les faces de départ.'],
          limits: 'Le script agit sur l’objet polygonal actif et compare les normales géométriques dans l’espace local de l’objet. Les faces masquées conservent leur état de sélection. Les normales Phong et les déformations ne sont pas évaluées ; les n-gones utilisent les triangles et quadrangles internes de Cinema 4D. Après un changement de topologie, mémoriser à nouveau les références. Ctrl+Z annule la sélection.',
          compatibility: 'Versions française et anglaise testées localement dans Cinema 4D 2026. Les deux versions utilisent la même logique de sélection.',
          scriptLanguage: 'Français',
          file: 'downloads/Select_Similar_Angle.py',
          alternate: { language: 'English', file: 'downloads/Select_Similar_Angle_EN.py', summary: 'Version anglaise — code et téléchargement' }
        },
        {
          id: 'keyframe-reducer', category: 'personal', title: 'Keyframe Reducer',
          version: '1.1.1', requirements: 'Blender 5.2 ou ultérieur',
          pageTitle: 'Keyframe Reducer pour Blender — Killian Pichon',
          meta: 'Add-on gratuit pour réduire les clés d’animation dans Blender, sur une copie : Action complète ou clés sélectionnées. Version 1.1.1 et guides français et anglais.',
          tags: ['Blender 5.2', 'Python', 'Animation · v1.1.1'],
          summary: 'Alléger les courbes d’animation pour faciliter le nettoyage de motion capture et les corrections à la main.',
          need: 'En travaillant avec des captures Brekel et Kinect v2 et des animations Mixamo, je me retrouvais avec des courbes denses, peu pratiques à retoucher dans Blender. Je voulais un workflow de réduction plus proche de celui que j’utilise dans Cinema 4D, avec un contrôle sur les passages à simplifier.',
          response: 'J’ai développé cet add-on avec l’aide de l’IA autour d’une Action source protégée, de tolérances ajustables et d’une comparaison avant/après. Le mode Selected Keys répond à un besoin apparu à l’usage : simplifier un passage tout en conservant l’animation autour.',
          result: 'L’outil me permet de comparer une copie réduite, d’ajuster le résultat depuis l’original et de le conserver pour la retouche. La version actuelle a été contrôlée dans Blender 5.2.1 LTS, notamment sur des passages d’une animation Mixamo et lors de la mise à jour d’un add-on déjà activé.',
          download: {
            title: 'Téléchargement',
            repository: 'KillianPi22/blender-keyframe-reducer',
            repositoryLabel: 'Code source et développement sur GitHub',
            release: 'v1.1.1',
            counter: 'keyframe-reducer',
            countLabel: 'téléchargements de l’add-on via GitHub',
            countNote: 'ZIP installables des versions publiques stables. Les anciens téléchargements du site, les liens de secours et les archives sources sont exclus.',
            file: 'downloads/keyframe-reducer/keyframe_reducer-1.1.1.zip',
            label: 'Télécharger l’add-on · v1.1.1 (.zip)',
            note: 'Gratuit · GPL-3.0-or-later · Code Python inclus. Installer ce ZIP directement dans Blender, sans le décompresser. Interface anglaise ; guides français et anglais inclus dans le ZIP.'
          },
          features: ['Réduire une Action complète ou seulement les clés sélectionnées dans le Graph Editor.', 'Ajuster Strength et les tolérances de position, rotation et échelle séparément.', 'Comparer Original / Reduced et recalculer depuis la source protégée.', 'Conserver les clés non sélectionnées, les intervalles et les bornes des passages.', 'Traiter un autre passage avec Reduce New Selection, puis conserver la copie pour retouche.'],
          workflow: ['Télécharger le ZIP ci-dessus. Dans Blender, ouvrir Edit → Preferences → Add-ons → Install from Disk et sélectionner ce ZIP sans le décompresser.', 'Sélectionner l’armature et son Action active. Pour un montage NLA, baker d’abord le mouvement dans une Action.', 'Dans le Graph Editor, appuyer sur N puis ouvrir Key Reducer. Choisir Entire Action, ou sélectionner des points de clés et choisir Scope → Selected Keys.', 'Cliquer sur Reduce on a Copy, comparer Original / Reduced, puis ajuster Strength et utiliser Recalculate from Source au besoin.', 'Pour une rotation quaternion, sélectionner W, X, Y et Z aux mêmes images. Chaque passage doit contenir au moins trois clés consécutives sélectionnées.', 'Cliquer sur Keep Copy for Editing avant de corriger les clés à la main. Pour simplifier d’abord un autre passage, afficher Reduced puis utiliser Reduce New Selection.'],
          limits: 'Traite l’Action active, pas la pile NLA. Le contrôle d’erreur échantillonne les transformations locales : il ne verrouille pas les pieds dans l’espace monde et ne supprime pas automatiquement les tremblements de capture. Les composantes quaternion doivent être sélectionnées ensemble. Selected Keys exclut les courbes masquées. Les courbes verrouillées et les canaux non pris en charge sont conservés.',
          compatibility: 'Blender 5.2 minimum. Contrôlé sous Windows dans Blender 5.2.1 LTS. Interface anglaise ; guides français et anglais. Aucune dépendance externe.'
        },
        {
          id: 'denon-sc2000-traktor', category: 'just-for-fun', title: 'Denon DN-SC2000 · Traktor Pro 4',
          meta: 'Mapping Denon DN-SC2000 pour Traktor Pro 4 : deux decks, effets et configuration MIDI documentée. Version 5.1.0 testée par Killian Pichon.',
          tags: ['Denon DN-SC2000', 'Traktor Pro 4', 'MIDI · v5.1.0'],
          summary: 'Un mapping et une méthode de configuration pour mes deux contrôleurs Denon.',
          need: 'Rendre mon installation DJ à deux contrôleurs fiable et reproductible.',
          response: 'Un TSI réunit Deck A/B, effets et retours LED. La longueur des boucles et la taille du Beatjump restent indépendantes.',
          result: 'Version 5.1.0 testée et validée localement avec mes deux contrôleurs Denon DN-SC2000.',
          workflow: ['Identifier chaque contrôleur et son canal MIDI avec Monitor.', 'Attribuer les ports d’entrée/sortie vérifiés ; désactiver les mappings en double.', 'Conserver les branchements USB et revérifier après un déplacement.'],
          compatibility: 'Ma configuration : Windows, Traktor Pro 4 et deux contrôleurs Denon DN-SC2000.',
          credits: 'Adapté du mapping de bascurtiz ; travail InstaPadFX original crédité à Stewe.',
          external: 'https://maps.djtechtools.com/mappings/22961',
          externalLabel: 'Mapping et guide complet sur DJ TechTools',
          externalNote: 'Connexion à DJ TechTools nécessaire pour télécharger.'
        }
      ],
      labels: { technical: 'Technique', open: 'Voir l’outil', back: 'Tous les outils et méthodes', need: 'Le besoin', response: 'La réponse', result: 'À l’usage', features: 'Commandes', workflow: 'Mode d’emploi', limits: 'Périmètre et limites', compatibility: 'Compatibilité', code: 'Code source Python', copy: 'Copier le code', download: 'Télécharger le .py', downloadTotal: 'téléchargements via GitHub (FR + EN)', downloadUnavailable: 'Compteur indisponible', downloadFallback: 'Téléchargement de secours', downloadNote: 'Total des deux langues et de toutes les versions. Copies du code et téléchargements de secours exclus.', copied: 'Code copié.', fallback: 'Copie automatique indisponible. Code sélectionné : utiliser Ctrl+C ou ⌘C.', source: 'Code à coller dans le Script Manager de Cinema 4D', codeHint: 'Le script complet ci-dessous est identique au fichier .py téléchargeable.', credit: 'Crédits', nav: 'Catégories d’outils', notes: 'Notes de production', privacy: 'Confidentialité', privacyChoices: 'Choix de confidentialité', demos: 'Autres démos', rights: '© 2026 · Tous droits réservés', work: 'Projets', about: 'Profil', contact: 'Contact' }
    }
  };
  if (typeof module === 'object' && module.exports) module.exports = content;
  else root.KP_TECHNICAL = content;
})(typeof window === 'object' ? window : globalThis);
