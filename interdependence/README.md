## How to run?

1. Move component-analyzer.js and code-city.html in to your React project.
2. Generate the interdependence data with:
```sh
node component-analyzer.js src/app --ts-config tsconfig.json --json component-dependencies.json
```
3. Locally visit the code-city.html and watch your city form!