#define MyAppVersion GetEnv("SKECHU_VERSION")

[Setup]
AppId={{9DDB9B8D-08C2-4853-A844-6BD5EC2ADDF0}
AppName=Skechu-PPT
AppVersion={#MyAppVersion}
AppPublisher=Hsiao, Chao-Hsiang
AppPublisherURL=https://github.com/evan6007/skechu-ppt
AppSupportURL=https://github.com/evan6007/skechu-ppt/issues
DefaultDirName={localappdata}\Programs\Skechu-PPT
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\..\dist-installer
OutputBaseFilename=Skechu-PPT-Windows-Setup
SetupIconFile=..\..\assets\brand\skechu-ppt-mark.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\Skechu-PPT.exe

[Files]
Source: "..\..\dist\Skechu-PPT\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Skechu-PPT"; Filename: "{app}\Skechu-PPT.exe"
Name: "{autodesktop}\Skechu-PPT"; Filename: "{app}\Skechu-PPT.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: checkedonce

[Run]
Filename: "{app}\Skechu-PPT.exe"; Description: "Open Skechu-PPT"; Flags: nowait postinstall skipifsilent
