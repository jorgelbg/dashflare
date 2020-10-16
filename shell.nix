let
  pkgs = import <nixpkgs> {};
in

pkgs.stdenv.mkDerivation {
  name = "dashflareio";

  buildInputs =
    [
      pkgs.nodejs
      pkgs.wrangler
    ];

    shellHook = ''
        export PATH="$PWD/node_modules/.bin/:$PATH"
        alias dev='wrangler dev --env=dev'
    '';
}
