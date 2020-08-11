M = $(shell printf "\033[34;1m▶\033[0m")
TEMPLATE = "wrangler.toml.template"
OUTPUT = "wrangler.toml"

.PHONY: help
help:
	@grep -hE '^[ a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-17s\033[0m %s\n", $$1, $$2}'

.PHONY: wrangler
wrangler: ; $(info $(M) generating wrangler.toml) @ ## Generate a wrangler.toml configuration file from the template
	@envsubst < $(TEMPLATE) > $(OUTPUT)
