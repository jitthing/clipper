cask "clipper" do
  version "0.4.4"
  sha256 "2c2b9aa7b57d73bf9df67b63565751a2ea8cafbff5a98dc5d38e1fed9f6dd466"

  url "https://github.com/jitthing/clipper/releases/download/v#{version}/Clipper_0.1.0_aarch64.dmg"
  name "Clipper"
  desc "Screenshot tool with smart window detection and inline annotations"
  homepage "https://github.com/jitthing/clipper"

  depends_on macos: ">= :ventura"

  app "Clipper.app"

  zap trash: [
    "~/Library/Application Support/com.clipper.app",
    "~/Library/Preferences/com.clipper.app.plist",
  ]
end
