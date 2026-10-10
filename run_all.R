# Reconstruit les fichiers lus par le site (docs/data).
# A lancer depuis la racine du projet.
for (script in c("R/01_bilans.R", "R/02_territoires.R")) {
  cat("\n==", script, "==\n")
  source(script, encoding = "UTF-8", local = new.env())
}
