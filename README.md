# tern_for_gedit (piped)

This is modified gedit plugin of [tern_for_gedit](https://github.com/Swatinem/tern_for_gedit) that provides code completion results
based on [tern](https://github.com/marijnh/tern). Only one difference is that it
uses STDIN/STDOUT streams instead of localhost-ed http server. This is fixes troubles with ".tern-port" file lookup.

Simply type to get identifier completion. Or force a completion popup by
pressing `<Ctrl>+Space`.

Press `<Alt>+F3` to select all references of the identifier at the cursor
position. This hooks into the Multi-Edit gedit plugin, so that needs to be
activated. Also, gedits multi-edit mode leaves a lot to be desired, it is still
quite buggy.

Press `<Alt>+.` to jump to the definition of the identifier at the cursor
position.

## installation

Copy `tern.plugin` and `tern/` to `~/.local/share/gedit/plugins/`.

This plugin expects `tern` to be installed globally.
So if you haven’t already:

    $ sudo npm install --global tern

## License

LGPL-3.0
