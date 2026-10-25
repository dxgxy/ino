import java.net.URI
import org.gradle.api.tasks.Exec

plugins { id("com.android.application") }

val apiUrl = providers.gradleProperty("wordflowApiUrl").orElse(providers.environmentVariable("WORDFLOW_API_URL")).orElse("http://10.0.2.2:8787")
val endpoint = URI(apiUrl.get())
require(endpoint.scheme in listOf("http", "https") && endpoint.host != null && endpoint.userInfo == null && endpoint.rawQuery == null && endpoint.fragment == null && endpoint.path in listOf("", "/")) { "wordflowApiUrl must be an HTTP(S) root URL" }
val webRoot = rootProject.projectDir.parentFile
val assetsRoot = layout.projectDirectory.dir("src/main/assets/web")

android {
    namespace = "com.xxdaren.wordflow"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.xxdaren.wordflow"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "WORDFLOW_API_URL", "\"${apiUrl.get().trimEnd('/')}\"")
        manifestPlaceholders["allowCleartext"] = "false"
    }

    buildTypes {
        getByName("debug") { manifestPlaceholders["allowCleartext"] = "true" }
        getByName("release") {
            manifestPlaceholders["allowCleartext"] = "false"
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    buildFeatures { buildConfig = true }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}

val buildWeb = tasks.register<Exec>("buildWeb") {
    workingDir(webRoot)
    commandLine("npm.cmd", "run", "build")
}
val syncWebAssets = tasks.register<Sync>("syncWebAssets") {
    dependsOn(buildWeb)
    from(webRoot.resolve("dist"))
    into(assetsRoot)
}
tasks.named("preBuild") { dependsOn(syncWebAssets) }
