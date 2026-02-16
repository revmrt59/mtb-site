Sub InjectMTBStylesPrecision()
    Dim folderPath As String
    Dim fileName As String
    Dim targetFile As String
    Dim doc As Document
    
    ' The exact path and file from your message
    folderPath = "C:\Users\Mike\Documents\MTB\mtb-source\source\books\new-testament\3-john\001\"
    targetFile = "3-john-1-chapter-explanation.docx"
    
    ' 1. Check if the file exists before trying to open it
    If Dir(folderPath & targetFile) = "" Then
        MsgBox "Cannot find the file: " & vbCrLf & folderPath & targetFile, vbCritical, "File Not Found"
        Exit Sub
    End If
    
    ' 2. Open the document
    Set doc = Documents.Open(FileName:=folderPath & targetFile, Visible:=True)
    
    ' 3. Create or Update Styles
    ' We use RGB for the green to ensure it looks good
    UpdateMTBStyle doc, "MTB Read", True, False, 0 ' Black
    UpdateMTBStyle doc, "MTB Explain", False, False, 0 ' Black
    UpdateMTBStyle doc, "MTB Dwell", False, True, 32768 ' Dark Green
    
    ' 4. Save and let you see it
    doc.Save
    MsgBox "Styles 'MTB Read', 'MTB Explain', and 'MTB Dwell' are now ready in 3 John.", vbInformation, "Success"
    
End Sub

Sub UpdateMTBStyle(doc As Document, sName As String, bBold As Boolean, bItalic As Boolean, lColor As Long)
    Dim s As Style
    On Error Resume Next
    ' Try to find the style, if it fails, create it
    Set s = doc.Styles(sName)
    If s Is Nothing Then
        Set s = doc.Styles.Add(Name:=sName, Type:=wdStyleTypeParagraph)
    End If
    On Error GoTo 0
    
    With s.Font
        .Bold = bBold
        .Italic = bItalic
        .Color = lColor
        .Name = "Segoe UI" ' Setting a clean web-friendly font
    End With
End Sub