@echo off
:: This script opens 5 specific folders in separate Windows Explorer windows

start explorer "C:\Users\Mike\Documents\MTB\mtb-source\source\books\new-testament\titus"
start explorer "C:\Users\Mike\Documents\MTB\GitHub\mtb-site\scripts"
start explorer "C:\Users\YourName\Downloads"
start explorer "C:\Users\Mike\Documents\MTB\GitHub\mtb-site"
start explorer "C:\Users\Mike\Documents\MTB\GitHub\mtb-site\books\new-testament\titus\generated"
start explorer "C:\Users\YourName\Downloads\C:\Users\Mike\Documents\MTB\GitHub\mtb-site\assets\js"
start explorer "C:\Users\YourName\Downloads\C:\Users\Mike\Documents\MTB\GitHub\mtb-site\assets\css"
Call "Python Server.bat"
exit
