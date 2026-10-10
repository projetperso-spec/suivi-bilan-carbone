# Bilans d'émissions de gaz à effet de serre publiés par les collectivités territoriales sur la
# plateforme de l'ADEME (jeu « Bilan GES », data.ademe.fr) : docs/data/bilans.json.
# Les coordonnées des personnes (responsable du suivi, téléphone, courriel) ne sont pas reprises.
library(curl)
library(jsonlite)

JEU <- "https://data.ademe.fr/data-fair/api/v1/datasets/9nd9avrbto3l14md-wkode4o"
lire <- function(url) fromJSON(rawToChar(curl_fetch_memory(url, handle = new_handle(useragent = "suivi-bilan-carbone (projet personnel)", timeout = 120))$content), simplifyVector = FALSE)

postes <- c("11", "12", "13", "14", "15", "21", "22", "31", "32", "33", "34", "35", "41", "42", "43", "44", "45", "51", "52", "53", "54", "61")
textes <- c(presentation = "presentation_de_lorganisation", politique = "politique_developpement_durable", actions = "actions_et_moyens",
            objectif2030 = "objectif_de_reduction_pour_2030", objectif2050 = "objectif_de_reduction_pour_2050",
            objectifAutre = "objectif_de_reduction_a_dautres_horizons_temporels",
            analyse = "analyse_des_resultats_obtenus_depuis_le_dernier_bilan_et_justification",
            ecartes = "justification_des_postes_demissions_indirectes_ecartes", rapport = "lien_url_vers_le_rapport_complet_du_beges")

lignes <- list()
url <- paste0(JEU, "/lines?size=1000&qs=", curl_escape('type_de_structure:"Collectivité territoriale (dont EPCI)"'))
while (!is.null(url)) { d <- lire(url); lignes <- c(lignes, d$results); url <- d[["next"]] }
cat(length(lignes), "bilans de collectivités lus\n")

nul <- function(x) if (is.null(x)) NA else x
bilans <- lapply(lignes, function(l) {
  agents <- suppressWarnings(as.numeric(gsub("[^0-9]", "", nul(l$nombre_de_salariesdagents_de_lensemble_des_siren_declares_sur_ce_bilan_lors_de_lannee_de_reporting_du_bilan))))
  tranche <- grepl("[A-Za-z]", nul(l$nombre_de_salariesdagents_de_lensemble_des_siren_declares_sur_ce_bilan_lors_de_lannee_de_reporting_du_bilan))
  b <- list(id = l$id, siren = l$siren_principal, nom = l$raison_sociale, type = nul(l$type_de_collectivite), dep = nul(l$code_departement),
            population = nul(l$population), annee = l$annee_de_reporting, publication = nul(l$date_de_publication),
            methode = nul(l$methode_beges_v4v5), obligee = nul(l$structure_obligee),
            agents = if (isTRUE(tranche) || is.na(agents)) NA else agents,
            emissions = lapply(setNames(postes, paste0("p", postes)), function(p) nul(l[[paste0("emissions_publication_p", p)]])),
            reference = if (isTRUE(l$une_annee_de_reference_a_ete_calculee)) lapply(setNames(postes, paste0("p", postes)), function(p) nul(l[[paste0("emissions_reference_p", p)]])) else NULL,
            anneeReference = nul(l$annee_de_reference),
            reductionDirectes = nul(l$reduction_attendue_des_emissions_directes),
            reductionIndirectes = nul(l$reduction_attendue_des_emissions_indirectes_significatives))
  for (k in names(textes)) b[[k]] <- nul(l[[textes[[k]]]])
  b
})
bilans <- Filter(function(b) !is.null(b$siren) && !is.null(b$annee), bilans)

dir.create("docs/data", recursive = TRUE, showWarnings = FALSE)
meta <- lire(JEU)
write_json(list(source = "ADEME, Centre de ressources Bilans GES, jeu « Bilan GES » (Licence Ouverte 2.0)", misAJour = substr(meta$dataUpdatedAt, 1, 10),
                releve = format(Sys.Date()), bilans = bilans),
           "docs/data/bilans.json", auto_unbox = TRUE, digits = NA, na = "null", null = "null")
cat(length(bilans), "bilans écrits,", length(unique(vapply(bilans, function(b) as.character(b$siren), ""))), "collectivités,", round(file.size("docs/data/bilans.json") / 1e6, 1), "Mo\n")
