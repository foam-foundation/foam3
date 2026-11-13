<flow name="DIG: Data Interchange Gateway" description="DIG provides a simple unified method for users and systems to interact with CORE Data Access Objects (DAOs)" accessLevel="PUBLIC_RO" keywords="knowledge,dig,dug,api,testing,postman" childLock="true"/>

#### DIG: Data Interchange Gateway



DIG provides a simple unified method for users and systems to interact with CORE Data Access Objects (DAOs).
A DAO is similar to a database table,
but with additional access control, performance monitoring, auditing, replication, validation, and business logic.

Commands(operations) that can be performed on a DAO include:
put, select, remove, and help. DIG supports multiple data formats,
including: XML, JSON, CSV, HTML, and JSON/J. DIG is intended as an end-point for programmatic integration,
but also includes a simple user interface to aid developers with the creation of their query parameters.



# User Guide

STEP 1. Pick a DAO.

STEP 2. Pick a Format.
Five formats include: XML, JSON, CSV, HTML, JSON/J

STEP 3. Pick a Command :

* PUT :

To add new records to a DAO.
Users can put one or more rows in the Data section. The format of data which is supposed to be put should match the format user selected in STEP 2.
Only followed format -  CSV, JSON, XML can be parsed on DIG when put.

* SELECT :

To select data from a DAO.
The result format is specified in STEP 2. If users pick the command SELECT, the Email and Subject fields are shown. If those are filled in, the results will be emailed rather than downloaded.

See https://github.com/foam-framework/foam/wiki/MQL---Query-Language for creating a **select query**.

* REMOVE :

Removes a row from the DAO selected in STEP 1.
The ID field is shown to specify the id of the row to be deleted.



STEP 4. Software Integration
DIG will provide a URL that specifies your choices from steps 1-3. Use this URL when generating AJAX requests from your software.





# Guidance of each data format

Tip: Before put in the data, It is recommended to perform select first to get the accurate format.

Each format structured for DAO format. Ex.:

JSON
* Text value must be included double quotes(“”).
  {"property1":"text","property2":number}

For more than a row, It should be below
[ { DAO }, { DAO } ...]


CSV
property1,property1
value1,value2

For more than a row, It should be below
property1,property1
{ DAO }
{ DAO }


XML

<objects>
<object>
<property1>value1</property1>
<property2>value2</property2>
</object>
</objects>

For more than a row, It should be below

<objects>
<object>
{ DAO }
</object>
<object>
{ DAO }
</object>
</objects>







#### SUGAR: Service Unified GAteway Relay



The Service Unified GAteway Relay (SUGAR) is an end-point which allows to access and invoke on FOAM services.
It generally interacts with non Data Access Objects (non DAOs).
With an HTTP post submitted to the web-callback URL, It is queried and returned values from services.

A SUGAR could be used, for example, to query verify an account or send Emails
At phase1, the javaType of the argument Info only supports String, double, long, int.
At phase 2, Objects parameters can be handled too including Enum type.


# User Guide

STEP 1. Select a Service.

STEP 2. Select one of the mapped methods.
Then the argument Info will be shown.

STEP 3. Input arguments’ in values or Object (if it is shown) in Value field
(It is automatically cast to each javaType when the method is performed)

