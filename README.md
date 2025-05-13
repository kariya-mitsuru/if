# Impact Framework

[![Node.js CI](https://github.com/Green-Software-Foundation/if/actions/workflows/nodejs-ci.yml/badge.svg)](https://github.com/Green-Software-Foundation/if/actions/workflows/nodejs-ci.yml)

> [!IMPORTANT]
> Graduated Project: This project is a Graduated Project, supported by the Green Software Foundation. The publicly available version documented in the README is trusted by the GSF. New versions of the project may be released, or it may move to the Maintained or Retired Stage at any moment.

**Our documentation is online at [if.greensoftware.foundation](https://if.greensoftware.foundation/)**

**IF** is a framework to **M**odel, **M**easure, si**M**ulate and **M**onitor the environmental impacts of software

Modern applications are composed of many smaller pieces of software (components) running on many different environments, for example, private cloud, public cloud, bare-metal, virtualized, containerized, mobile, laptops, and desktops.

Every environment requires a different plugin of measurement, and there is no single solution you can use to calculate the environmental impacts for all components across all environments.

The friction to measuring software emissions isn't that we need to know how, it's that we run software on many things and each thing has several different ways to measure.

Read the [specification and design docs](https://if.greensoftware.foundation) to begin.

## Get started

IF is a framework for running pipelines of plugins that operate on a set of observations. This is all configured using a manifest file. We provide a standard library of plugins that come bundled with IF - we refer to these as `builtins`. We also have an [Explorer](https://explorer.if.greensoftware.foundation) where anyone can list third party plugins you can install.

Start by installing the latest version of IF:

```sh
npm install -g "@grnsft/if"
```

Then create a `manifest` file that describes your application (see our docs for a detailed explanation).

Then, run `if` using the following command:

```sh
if-run --manifest <path-to-your-manifest-file>
## or you can use alias
if-run -m <path-to-your-manifest-file>

```

Note that above command will print your outputs to the console. If you do not want to print the outputs to the console, you need to provide `--no-output` command. You can also provide the `--output` command to save your outputs to a yaml file:

```sh
if-run -m <path-to-your-manifest> -o <savepath>
```

The `if-run` CLI tool will configure and run the plugins defined in your input `yaml` (`manifest`) and return the results as an output `yaml` (`output`).

Use the `debug` command if you want to diagnose and fix errors in your plugin:

```sh
if-run --manifest <path-to-your-manifest-file> --debug
```

Use the `help` command if you need guidance about the available commands

```sh
if-run --help
## or using alias
if-run -h
```

### Using API server

The Impact Framework also provides an API server. By default, it listens on localhost:3000, but this can be changed.

```sh
# Run the API server listening on the default localhost:3000.
$ if-api

# Run the API server listening on 0.0.0.0:8080.
$ if-api --host 0.0.0.0 --port 8080
```

If the API server is running, you can send a manifest in the request body and receive the results of `if-run` as a response.

```sh
# Process manifest
$ curl -H "Content-Type: application/yaml" --data-binary @manifest.yaml http://localhost:3000/v1/run
```

Note that in `if-api`, the following builtin plugins are disabled by default for security reasons.
- Shell
- CSVImport
- CSVLookup

Please refer to the documentation for detailed usage instructions, including how to enable these plugins.

## Using Docker Container

The Impact Framework API server can also be run as a Docker container.
The official image is provided at `ghcr.io/green-software-foundation/if`.

### Running the Container

Run a container using the built image:

```sh
# Run with default port (3000)
$ docker run --rm -p 3000:3000 ghcr.io/green-software-foundation/if

# Run with custom port
$ docker run --rm -p 8080:3000 ghcr.io/green-software-foundation/if
```

### Using the containerized API server

The containerized API server provides the same endpoints as the regular API server:

```sh
# Health check
$ curl http://localhost:3000/health

# Process manifest (YAML request)
$ curl -H "Content-Type: application/yaml" --data-binary @manifest.yaml http://localhost:3000/v1/run

# Process manifest (JSON request)
$ curl --json @manifest.json http://localhost:3000/v1/run
```

### Adding external plugins at startup time
You can add any external plugins at startup time by mounting a file that lists the plugins to `/app/plugins.txt`.
```sh
$ cat plugins.txt
carbon-intensity-plugin
Green-Software-Foundation/if-github-plugin
$ docker run --rm -p 3000:3000 -v $(pwd)/plugins.txt:/app/plugins.txt ghcr.io/green-software-foundation/if
```

The contents of `/app/plugins.txt` are used directly as arguments for `npm install`. For available formats, refer to: https://docs.npmjs.com/cli/v8/commands/npm-install

If the plugin itself or packages it depends on are private, you'll need to mount an `.npmrc` file for the access token required to install packages.
```sh
$ cat plugins.txt
@myscope/myplugin
$ cat .npmrc
//registry.npmjs.org/:_authToken=<YOUR_AUTH_TOKEN>
@myscope:registry=https://registry.npmjs.org/
$ docker run --rm -p 3000:3000 -v $(pwd)/plugins.txt:/app/plugins.txt -v $(pwd)/.npmrc:/app/.npmrc ghcr.io/green-software-foundation/if
```

For `.npmrc` format reference: https://docs.npmjs.com/cli/v8/configuring-npm/npmrc

Note that if the plugin itself or packages it depends on are in GitHub Packages, a personal access token (classic) with `read:packages` permission is required even for public packages.
```sh
$ cat plugins.txt
danuw/if-casdk-plugin
$ cat .npmrc
//npm.pkg.github.com/:_authToken=<YOUR_PERSONAL_ACCESS_TOKEN>
@Green-Software-Foundation:registry=https://npm.pkg.github.com/
$ docker run --rm -p 3000:3000 -v $(pwd)/plugins.txt:/app/plugins.txt -v $(pwd)/.npmrc:/app/.npmrc ghcr.io/green-software-foundation/if
```

Alternatively, the access token can also be extracted to an environment variable.
```sh
$ cat plugins.txt
@myscope/myplugin
$ cat .npmrc
//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}
@myscope:registry=https://registry.npmjs.org/
$ docker run --rm -p 3000:3000 -v $(pwd)/plugins.txt:/app/plugins.txt -e NODE_AUTH_TOKEN=<YOUR_AUTH_TOKEN> -v $(pwd)/.npmrc:/app/.npmrc ghcr.io/green-software-foundation/if
```

### Building the Container Image

As mentioned above, there are official images available, but you can also build your own container image using the provided `Dockerfile`:

```sh
# Build the container image
$ docker build -t myorg/if:v1.0.0 .
```
### Creating Slim Image

As mentioned above, the built container image can install external plugins during startup. However, if you know that you don't need to install external plugins from git repositories like GitHub during startup, you can create a slimmer container image without git by specifying the `--build-arg PACKAGES=` option in the container image build command.

```sh
# Build custom image without git
$ docker build -t myorg/if:v1.0.0-slim --build-arg PACKAGES= .
```

Note that the absence of git does not affect the installation of npm packages.

```sh
# Run the custom image with the npm package
$ cat plugins-startup.txt
carbon-intensity-plugin
$ docker run --rm -p 3000:3000 -v $(pwd)/plugins-startup.txt:/app/plugins.txt myorg/if:v1.0.0-slim
```

### Building the Container Image with external plugins

You can also create container images that include external plugins in advance.

```sh
$ cat with-plugins/plugins.txt
carbon-intensity-plugin
Green-Software-Foundation/if-github-plugin
$ docker build -t myorg/if-with-plugins:v1.0.0 with-plugins
```

A `.npmrc` is required if you need an access token, as well as if you want to add external plugins when starting the container.

```sh
$ cat with-plugins/plugins.txt
danuw/if-casdk-plugin
$ cat with-plugins/.npmrc
//npm.pkg.github.com/:_authToken=<YOUR_PERSONAL_ACCESS_TOKEN>
@Green-Software-Foundation:registry=https://npm.pkg.github.com/
$ docker build -t myorg/if-with-plugins:v1.0.0 with-plugins
```

Note that, as with regular images, you can also create a slim image without git by adding the `--build-arg PACKAGES=` option.

## Deploy the API server to Kubernetes

The Impact Framework also provides a helm chart for running the API server on a Kubernetes cluster.

```sh
$ helm install if-api ./helm-chart
```

### Adding Plugins

You can also install additional plugins.

```yaml
additionalPlugins:
- carbon-intensity-plugin
- Green-Software-Foundation/if-github-plugin
```

If an `.npmrc` file is required, you can create a `Secret` by specifying it in the `npmrc` section of the `values.yaml` file.

```yaml
additionalPlugins:
- Green-Software-Foundation/community-plugins
- danuw/if-casdk-plugin

npmrc: |
  //npm.pkg.github.com/:_authToken=<YOUR_PERSONAL_ACCESS_TOKEN>
  @Green-Software-Foundation:registry=https://npm.pkg.github.com/
```

You can also extract the access token as an environment variable.

```yaml
additionalPlugins:
- Green-Software-Foundation/community-plugins
- danuw/if-casdk-plugin

npmrc: |
  //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
  @Green-Software-Foundation:registry=https://npm.pkg.github.com/

env:
  secret:
    GITHUB_TOKEN: <YOUR_PERSONAL_ACCESS_TOKEN>
```

### Using Kubernetes service

By default, a `ClusterIP` service is deployed, so you can access the API server by running `kubectl port-forward`.

```sh
$ kubectl port-forward svc/if-api 3000:3000 &
$ curl -H "Content-Type: application/yaml" --data-binary @manifest.yaml http://localhost:3000/v1/run
```

You can access the API server from outside the cluster without using `port-forward` by changing the service type to `NodePort` or `LoadBalancer`.

`values.yaml` for the `NodePort`:

```yaml
# Using NodePort
service:
  type: NodePort
  nodePort: 32000
```

`values.yaml` for the `LoadBalancer`:

```yaml
# Using LoadBalancer
service:
  type: LoadBalancer
```

## Documentation

Please read our documentation at [if.greensoftware.foundation](https://if.greensoftware.foundation/)

## Join our mailing list

We have a public mailing list at [if-community@greensoftware.foundation](https://groups.google.com/u/1/a/greensoftware.foundation/g/if-community). We send out weekly updates that explain what we've shipped, what we're working on and how you can get involved each week!

## Contributing

To contribute to IF, please fork this repository and raise a pull request from your fork.

You can check our issue board for issues. We mark some issues `core-only` if they are somehow sensitive and we want one of our core developers to handle it. Any other issues are open for the community to work on. We recommend commenting on the issue to start a chat with the core team, then start working on the issue when you have been assigned to it. This process helps to ensure your work is aligned with our roadmap and makes it much more likely that your changes will get merged compared to unsolicited PRs.

Please read the full contribution guidelines at [if.greensoftware.foundation](https://if.greensoftware.foundation/Contributing)

## Bug reports

To report bugs please use our bug report template. You can do this by opening a new issue and selecting `Bug Report` when you are prompted to pick a template. The more information you provide,.the quicker we will be able to reproduce, diagnose and triage your issue.

To read about our bug reporting and triage process, please see [our contribution guidelines](contributing.md#reporting-bugs).
