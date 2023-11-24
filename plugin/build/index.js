"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withAndroidWatermelon = exports.withIosWatermelon = void 0;
const config_plugins_1 = require("@expo/config-plugins");
const generateCode_1 = require("@expo/config-plugins/build/utils/generateCode");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const readFileAsync = async (path) => fs_extra_1.default.promises.readFile(path, 'utf-8');
const writeFileAsync = async (path, content) => fs_extra_1.default.promises.writeFile(path, content, 'utf-8');
const iosPlugin = (c) => (0, config_plugins_1.withDangerousMod)(c, [
    'ios',
    async (config) => {
        const podfile = path_1.default.join(config.modRequest.platformProjectRoot, 'Podfile');
        const contents = await readFileAsync(podfile);
        await writeFileAsync(podfile, (0, generateCode_1.mergeContents)({
            tag: `@nozbe/watermelondb`,
            src: contents,
            newSrc: `pod 'simdjson', path: '../node_modules/@nozbe/simdjson', modular_headers: true`,
            offset: 0,
            comment: '#',
            anchor: /flipper_config = FlipperConfiguration.disabled/,
        }).contents);
        return config;
    },
]);
const androidPlugin = (c) => (0, config_plugins_1.withDangerousMod)(c, [
    'android',
    async (config) => {
        const { platformProjectRoot } = config.modRequest;
        /**
         * JSI Step 1: make sure you have NDK installed (version 23.1.7779620 has been tested to work)
         */
        /**
         * JSI Step 2: create new project in android/settings.gradle
         */
        const settingsFile = path_1.default.join(platformProjectRoot, 'settings.gradle');
        const settingsContents = await readFileAsync(settingsFile);
        await writeFileAsync(settingsFile, (0, generateCode_1.mergeContents)({
            tag: `@nozbe/watermelondb/jsi-installation`,
            src: settingsContents,
            newSrc: `
		include ':watermelondb-jsi'
		project(':watermelondb-jsi').projectDir =
				new File(rootProject.projectDir, '../node_modules/@nozbe/watermelondb/native/android-jsi')`,
            offset: 0,
            comment: '//',
            anchor: "include ':app'",
        }).contents);
        /**
         * JSI Step 3: add project created from step 2 as a dependency to the app
         */
        const buildFile = path_1.default.join(platformProjectRoot, 'app/build.gradle');
        const buildContents = await readFileAsync(buildFile);
        await writeFileAsync(buildFile, (0, generateCode_1.mergeContents)({
            tag: `@nozbe/watermelondb/jsi-installation`,
            src: buildContents,
            newSrc: `implementation project(':watermelondb-jsi')`,
            offset: 4,
            comment: '//',
            anchor: /def isGifEnabled = \(findProperty\('expo\.gif\.enabled'\) \?: ""\) == "true";/,
        }).contents);
        /**
         * JSI Step 4: add proguard rules
         */
        const proguardFile = path_1.default.join(platformProjectRoot, 'app/proguard-rules.pro');
        const proguardContents = await readFileAsync(proguardFile);
        await writeFileAsync(proguardFile, (0, generateCode_1.mergeContents)({
            tag: `@nozbe/watermelondb/jsi-installation`,
            src: proguardContents,
            newSrc: `-keep class com.nozbe.watermelondb.** { *; }`,
            offset: 0,
            comment: '#',
            anchor: /# Add any project specific keep options here:/,
        }).contents);
        /**
         * JSI Step 5: modify MainApplication.java
         */
        const mainApplicationFile = path_1.default.join(platformProjectRoot, `app/src/main/java/${config.android?.package?.replace(/\./g, '/')}/MainApplication.java`);
        const mainApplicationContents = await readFileAsync(mainApplicationFile);
        const lines = mainApplicationContents.split('\n');
        let insertAfter = lines.findIndex((obj) => obj === 'import java.util.List;');
        if (insertAfter === -1) {
            throw new Error('Could not find the correct starting index for imports');
        }
        insertAfter += 1;
        const imports = `
import java.util.Arrays;
import com.facebook.react.bridge.JSIModuleSpec;
import com.facebook.react.bridge.JSIModulePackage;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.JavaScriptContextHolder;
import com.nozbe.watermelondb.jsi.WatermelonDBJSIPackage;

`;
        lines.splice(insertAfter, 0, imports);
        let secondStartingIndex = lines.findIndex((obj) => obj.includes('isHermesEnabled()'));
        if (secondStartingIndex === -1) {
            throw new Error('Could not find the correct starting index for the JSIModulePackage override');
        }
        /**
         *  sets the secondStarting index to insert after this block in MainActivity.java:
         *
         * 														@Override
   *  													protected Boolean isHermesEnabled() {
   *                          		return BuildConfig.IS_HERMES_ENABLED;
         *														}

         */
        secondStartingIndex += 3;
        const moreLinesToAdd = `
			@Override
			protected JSIModulePackage getJSIModulePackage() {
				return new JSIModulePackage() {
					@Override
					public List<JSIModuleSpec> getJSIModules(
						final ReactApplicationContext reactApplicationContext,
						final JavaScriptContextHolder jsContext
					) {
						List<JSIModuleSpec> modules = Arrays.asList();

						modules.addAll(new WatermelonDBJSIPackage().getJSIModules(reactApplicationContext, jsContext));
						// ⬅️ add more JSI packages here by conventions above

						return modules;
					}
				};
			}`;
        lines.splice(secondStartingIndex, 0, moreLinesToAdd);
        await writeFileAsync(mainApplicationFile, lines.join('\n'));
        return config;
    },
]);
const withIosWatermelon = (config) => (0, config_plugins_1.withPlugins)(config, [iosPlugin]);
exports.withIosWatermelon = withIosWatermelon;
const withAndroidWatermelon = (config) => (0, config_plugins_1.withPlugins)(config, [androidPlugin]);
exports.withAndroidWatermelon = withAndroidWatermelon;
const withWatermelon = (config) => (0, config_plugins_1.withPlugins)(config, [iosPlugin, androidPlugin]);
exports.default = withWatermelon;
